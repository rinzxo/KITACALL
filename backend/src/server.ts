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

// API Routes untuk Workspace, Anggota, dan Manajemen Saluran
app.use('/api', workspaceRoutes);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'KitaCom / KitaRadio Tactical Relay',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/channels/:channelId/roster', (req, res) => {
  const { channelId } = req.params;
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

  // 1. kitacom:join_channel (Verifikasi hak akses channel & isolasi frekuensi)
  socket.on('kitacom:join_channel', async (payload: JoinChannelPayload) => {
    const { channelId, userId, userName, role, dutyMode, posJaga } = payload;
    
    // Verifikasi Otoritas Personel:
    // 1. Role Komando (Koordinator Keamanan, Ketua Pelaksana, Pembina) punya izin akses semua frekuensi
    // 2. Saluran default CH-01 terbuka untuk seluruh personel satgas
    // 3. Saluran lain hanya bisa dimasuki oleh personel yang ditugaskan di kitacom_channel_members
    const isCommander = role === 'KOORDINATOR_KEAMANAN' || role === 'KETUA_PELAKSANA' || role === 'PEMBINA';

    if (!isCommander && channelId && channelId !== 'CH-01') {
      try {
        const client = await dbPool.connect();
        try {
          const chanRes = await client.query(
            `SELECT id, code FROM kitacom_channels WHERE id::text = $1 OR code = $1`,
            [channelId]
          );
          const channelRow = chanRes.rows[0];
          if (channelRow && channelRow.code !== 'CH-01') {
            const memRes = await client.query(
              `SELECT id FROM kitacom_channel_members WHERE channel_id = $1 AND profile_id::text = $2`,
              [channelRow.id, userId]
            );
            if (memRes.rows.length === 0) {
              console.warn(`[KitaRadio Security] Akses ditolak: ${userName} (${userId}) bukan anggota saluran ${channelRow.code}`);
              socket.emit('kitacom:access_denied', {
                channelId,
                channelCode: channelRow.code,
                reason: `Akses ditolak: Anda belum ditugaskan oleh Koordinator di saluran frekuensi ${channelRow.code}.`
              });
              return;
            }
          }
        } finally {
          client.release();
        }
      } catch (dbErr) {
        console.error('[KitaRadio DB] Gagal verifikasi izin saluran:', dbErr);
      }
    }

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
      role,
      dutyMode: dutyMode ?? true,
      posJaga: posJaga || 'Patroli Lapangan'
    });

    console.log(`[KitaRadio] ${userName} (${role}) joined channel ${channelId}`);

    // Broadcast updated roster to channel
    const roster = channelState.getChannelRoster(channelId);
    kitaradio.to(channelId).emit('kitacom:roster_update', { channelId, roster });

    // Send current floor state to newly joined client
    const currentFloor = floorControl.toBroadcastState(channelId);
    socket.emit('ptt:floor_state', currentFloor);
  });

  // 2. kitacom:heartbeat (dikirim tiap 15s oleh client)
  socket.on('kitacom:heartbeat', (payload: HeartbeatPayload) => {
    const { channelId, audioCtxState, wakeLock, batteryLvl, dutyMode } = payload;
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
    payload.socketId = socket.id;
    const { channelId, userId, userName, role } = payload;
    
    // Pastikan pengirim adalah personel yang sah dan benar-benar aktif di channel ini
    const roster = channelState.getChannelRoster(channelId);
    const isMember = roster.some(m => m.socketId === socket.id || m.userId === userId);
    if (!isMember) {
      console.warn(`[KitaRadio Floor] Penolakan transmisi: ${userName} bukan anggota aktif di saluran ${channelId}`);
      socket.emit('ptt:floor_denied', {
        reason: 'UNAUTHORIZED_NOT_IN_CHANNEL',
        channelId
      });
      return;
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
      console.log(`[KitaRadio] Floor DENIED to ${userName} (Busy)`);
      socket.emit('ptt:floor_denied', {
        reason: result.reason || 'CHANNEL_BUSY',
        channelId
      });
    }
  });

  // 4. ptt:release_floor (Saat PTT dilepas)
  socket.on('ptt:release_floor', (payload: { channelId: string; userId: string }) => {
    const { channelId, userId } = payload;
    const released = floorControl.releaseFloor(channelId, socket.id);
    
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

  // 7. ptt:emergency_alert (Siaga Darurat Komandan)
  socket.on('ptt:emergency_alert', (payload: { workspaceId: string; channelId: string; commanderName: string; emergencyNote: string }) => {
    const { channelId, commanderName, emergencyNote } = payload;
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
  console.log(`=================================================`);
});
