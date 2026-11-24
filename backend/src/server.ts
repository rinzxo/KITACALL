import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { channelState } from './sockets/channelState';
import { floorControl } from './sockets/floorManager';
import { JoinChannelPayload, HeartbeatPayload, RequestFloorPayload } from './types';
import { dbPool } from './db/initTables';

import workspaceRoutes from './routes/workspaceRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4001;

app.use(cors({ origin: '*' }));
app.use(express.json());

// API Routes untuk Workspace & Kanal (termasuk Pairing Code)
app.use('/api', workspaceRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'KitaCom / KitaRadio Tactical Pairing Relay',
    timestamp: new Date().toISOString()
  });
});

// REST API untuk Pairing Channels
app.post('/api/channels/pairing/create', async (req, res) => {
  try {
    const { name, requestedCode, createdBy } = req.body;
    let code = requestedCode ? requestedCode.toUpperCase().trim().replace(/[^A-Z0-9-]/g, '') : '';
    
    if (!code) {
      // Buat Pairing Code acak yang mudah dibaca: contoh KT-8492
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      code = `KT-${randomNum}`;
    }

    const channelName = name && name.trim() ? name.trim() : `Saluran ${code}`;
    const meta = channelState.registerChannel(code, channelName, createdBy);

    // Coba simpan ke DB PostgreSQL jika koneksi tersedia
    try {
      const client = await dbPool.connect();
      try {
        await client.query(`
          INSERT INTO kitacom_channels (code, name, category, description)
          VALUES ($1, $2, 'Pairing Channel', 'Saluran Taktis via Pairing Code')
          ON CONFLICT (organization_id, code) DO NOTHING
        `, [code, channelName]);
      } catch (dbErr) {
        // Abaikan jika constraint organisasi belum siap, in-memory Map tetap aktif
      } finally {
        client.release();
      }
    } catch (e) {}

    res.json({ success: true, channel: meta });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/channels/pairing/:code', (req, res) => {
  const code = req.params.code.toUpperCase().trim();
  const meta = channelState.getChannelMeta(code);
  const roster = channelState.getChannelRoster(code);
  const floor = floorControl.toBroadcastState(code);

  if (meta) {
    res.json({ success: true, channel: { ...meta, memberCount: roster.length }, floor });
  } else {
    // Jika belum terdaftar namun dipanggil, langsung daftarkan on-the-fly
    const newMeta = channelState.registerChannel(code, `Saluran ${code}`);
    res.json({ success: true, channel: { ...newMeta, memberCount: roster.length }, floor });
  }
});

app.get('/api/channels/pairing', (req, res) => {
  const channels = channelState.getAllChannels();
  res.json({ success: true, channels });
});

app.get('/api/channels/:channelId/roster', (req, res) => {
  const channelId = req.params.channelId.toUpperCase().trim();
  const roster = channelState.getChannelRoster(channelId);
  const floor = floorControl.toBroadcastState(channelId);
  res.json({ channelId, roster, floor });
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  maxHttpBufferSize: 1e6 // 1MB buffer limit
});

// Namespace /kitaradio sesuai PRD
const kitaradio = io.of('/kitaradio');

kitaradio.on('connection', (socket: Socket) => {
  console.log(`[KitaRadio] Client connected: ${socket.id}`);

  // 1. kitacom:join_channel (Pairing Code Channel Join)
  socket.on('kitacom:join_channel', async (payload: JoinChannelPayload & { channelName?: string }) => {
    const channelId = (payload.channelId || 'CH-01').toUpperCase().trim();
    const { userId, userName, role, dutyMode, posJaga, channelName } = payload;
    
    // Register metadata saluran jika belum ada
    channelState.registerChannel(channelId, channelName || `Saluran ${channelId}`);

    // Keluar dari room channel sebelumnya agar suara tidak bocor antar frekuensi
    Array.from(socket.rooms).forEach(room => {
      if (room !== socket.id && room !== channelId) {
        socket.leave(room);
        channelState.removeMember(room, socket.id);
        const prevRoster = channelState.getChannelRoster(room);
        kitaradio.to(room).emit('kitacom:roster_update', { channelId: room, roster: prevRoster });
      }
    });

    socket.join(channelId);
    channelState.addMember(channelId, socket.id, {
      userId,
      userName,
      role: role || 'ANGGOTA_KEAMANAN',
      dutyMode: dutyMode ?? true,
      posJaga: posJaga || 'Patroli Lapangan'
    });

    console.log(`[KitaRadio] ${userName} (${role}) paired & joined channel ${channelId}`);

    // Broadcast updated roster to channel
    const roster = channelState.getChannelRoster(channelId);
    kitaradio.to(channelId).emit('kitacom:roster_update', { channelId, roster });

    // Send current floor state to newly joined client
    const currentFloor = floorControl.toBroadcastState(channelId);
    socket.emit('ptt:floor_state', currentFloor);
  });

  // 2. kitacom:heartbeat (dikirim tiap 15s oleh client)
  socket.on('kitacom:heartbeat', (payload: HeartbeatPayload) => {
    const channelId = (payload.channelId || 'CH-01').toUpperCase().trim();
    const { audioCtxState, wakeLock, batteryLvl, dutyMode } = payload;
    const updated = channelState.updateHeartbeat(channelId, socket.id, {
      audioCtxState,
      wakeLock,
      batteryLvl,
      dutyMode
    });

    if (updated) {
      // Sync roster state periodically
      const roster = channelState.getChannelRoster(channelId);
      kitaradio.to(channelId).emit('kitacom:roster_update', { channelId, roster });
    }
  });

  // 3. ptt:request_floor (Hold-to-Talk atau Tap-to-Latch)
  socket.on('ptt:request_floor', (payload: RequestFloorPayload) => {
    const channelId = (payload.channelId || 'CH-01').toUpperCase().trim();
    payload.channelId = channelId;
    payload.socketId = socket.id;
    const { userId, userName } = payload;
    
    // Pastikan pengirim adalah personel yang sah dan terdaftar di channel ini
    const roster = channelState.getChannelRoster(channelId);
    const isMember = roster.some(m => m.socketId === socket.id || m.userId === userId);
    if (!isMember) {
      // Jika socket belum tercatat di channel roster (misal reconnect kilat), tambahkan otomatis
      channelState.addMember(channelId, socket.id, {
        userId,
        userName,
        role: payload.role || 'ANGGOTA_KEAMANAN',
        dutyMode: true,
        posJaga: 'Patroli Lapangan'
      });
      socket.join(channelId);
    }

    const result = floorControl.requestFloor(payload, kitaradio as any, (expChannelId, expUserId) => {
      // On TOT Expire callback (60s limit)
      console.log(`[KitaRadio] TOT Expired for user ${expUserId} on channel ${expChannelId}`);
      const idleState = floorControl.toBroadcastState(expChannelId);
      kitaradio.to(expChannelId).emit('ptt:floor_state', idleState);
      kitaradio.to(expChannelId).emit('ptt:tot_timeout', { userId: expUserId, message: 'Batas waktu transmisi 60 detik tercapai' });
    });

    if (result.granted) {
      console.log(`[KitaRadio] Floor GRANTED to ${userName} (socket: ${socket.id}) on ${channelId}`);
      const state = floorControl.toBroadcastState(channelId);
      kitaradio.to(channelId).emit('ptt:floor_state', state);
    } else {
      console.log(`[KitaRadio] Floor DENIED to ${userName} (Reason: ${result.reason || 'Busy'})`);
      socket.emit('ptt:floor_denied', {
        reason: result.reason || 'CHANNEL_BUSY',
        channelId
      });
    }
  });

  // 4. ptt:release_floor (Saat PTT dilepas)
  socket.on('ptt:release_floor', (payload: { channelId: string; userId: string }) => {
    const channelId = (payload.channelId || 'CH-01').toUpperCase().trim();
    const { userId } = payload;
    let released = floorControl.releaseFloor(channelId, socket.id);
    if (!released && userId) {
      released = floorControl.releaseFloor(channelId, userId);
    }
    
    if (released) {
      console.log(`[KitaRadio] Floor RELEASED by ${userId} (socket: ${socket.id}) on ${channelId}`);
      const state = floorControl.toBroadcastState(channelId);
      // Memicu Roger Beep di semua penerima
      kitaradio.to(channelId).emit('ptt:floor_state', state);
    }
  });

  // 5. WebRTC Signaling Relays for Ultra-Low Latency Opus Voice
  socket.on('webrtc:offer', (payload: { toSocketId: string; offer: any }) => {
    kitaradio.to(payload.toSocketId).emit('webrtc:offer', {
      fromSocketId: socket.id,
      offer: payload.offer
    });
  });

  socket.on('webrtc:answer', (payload: { toSocketId: string; answer: any }) => {
    kitaradio.to(payload.toSocketId).emit('webrtc:answer', {
      fromSocketId: socket.id,
      answer: payload.answer
    });
  });

  socket.on('webrtc:ice_candidate', (payload: { toSocketId: string; candidate: any }) => {
    kitaradio.to(payload.toSocketId).emit('webrtc:ice_candidate', {
      fromSocketId: socket.id,
      candidate: payload.candidate
    });
  });

  // 6. ptt:emergency_alert (Siaga Darurat Komandan)
  socket.on('ptt:emergency_alert', (payload: { workspaceId?: string; channelId: string; commanderName: string; emergencyNote: string }) => {
    const channelId = (payload.channelId || 'CH-01').toUpperCase().trim();
    const { commanderName, emergencyNote } = payload;
    console.log(`[KitaRadio] EMERGENCY ALERT by ${commanderName} on ${channelId}: ${emergencyNote}`);
    
    // Broadcast emergency siren trigger ke semua client di channel
    kitaradio.to(channelId).emit('ptt:emergency_alert', {
      channelId,
      commanderName,
      emergencyNote,
      timestamp: Date.now()
    });
  });

  // 7. Disconnect handler
  socket.on('disconnect', () => {
    const removed = channelState.removeMemberBySocket(socket.id);
    if (removed) {
      console.log(`[KitaRadio] User ${removed.userName} disconnected from ${removed.channelId}`);
      
      // Jika user yang disconnect sedang memegang floor, rilis floor agar jalur tidak nyangkut
      const floor = floorControl.getFloorState(removed.channelId);
      if (floor.status === 'LOCKED' && (floor.speakerSocketId === socket.id || floor.speakerId === removed.userId)) {
        floorControl.releaseFloor(removed.channelId, socket.id);
        const idleState = floorControl.toBroadcastState(removed.channelId);
        kitaradio.to(removed.channelId).emit('ptt:floor_state', idleState);
      }

      // Kirim pembaruan roster
      const roster = channelState.getChannelRoster(removed.channelId);
      kitaradio.to(removed.channelId).emit('kitacom:roster_update', {
        channelId: removed.channelId,
        roster
      });
    }
  });
});

server.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`[KitaRadio & KitaCom Engine] Server Running on Port ${PORT}`);
  console.log(`Namespace: /kitaradio | Health check: http://localhost:${PORT}/health`);
  console.log(`Pairing Channels API: http://localhost:${PORT}/api/channels/pairing`);
  console.log(`=================================================`);
});
