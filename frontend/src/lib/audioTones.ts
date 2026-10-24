/**
 * Generator Nada Sintetis Audio HT Taktis KitaRadio
 * Menggunakan Web Audio API OscillatorNode murni (Zero External Files)
 * Sesuai PRD Seksi 3.2 & 5
 */

export class TacticalAudioSynthesizer {
  /**
   * Talk Permit Chirp: Dua nada cepat (1200Hz diikuti 1600Hz selama 180ms)
   * Berbunyi saat tombol PTT ditekan dan jalur berhasil dikunci
   */
  static async playTalkPermitChirp(ctx: AudioContext) {
    try {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const now = ctx.currentTime + 0.04;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      
      // Frekuensi 1200Hz (80ms) -> 1600Hz (100ms)
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.setValueAtTime(1600, now + 0.08);

      // Amplop volume jelas dan terdengar di speaker laptop/ponsel
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.6, now + 0.015);
      gain.gain.setValueAtTime(0.6, now + 0.16);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.19);
    } catch (e) {
      console.warn('[KitaCom] Gagal memainkan Permit Chirp:', e);
    }
  }

  /**
   * Roger Beep: Nada penutup 1050Hz selama 150ms
   * Berbunyi otomatis di seluruh perangkat penerima tepat saat penutur melepas PTT
   */
  static async playRogerBeep(ctx: AudioContext) {
    try {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const now = ctx.currentTime + 0.04;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1050, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.6, now + 0.015);
      gain.gain.setValueAtTime(0.6, now + 0.13);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.16);
    } catch (e) {
      console.warn('[KitaCom] Gagal memainkan Roger Beep:', e);
    }
  }

  /**
   * Channel Busy Alert: Nada rendah berulang 380Hz
   * Berbunyi jika mencoba memencet PTT saat jalur sedang terisi oleh orang lain
   */
  static async playChannelBusyTone(ctx: AudioContext) {
    try {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const now = ctx.currentTime + 0.04;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(380, now);

      // 2 denyut cepat tegas (100ms beep, 50ms pause, 100ms beep)
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.45, now + 0.01);
      gain.gain.setValueAtTime(0.001, now + 0.1);
      gain.gain.setValueAtTime(0.45, now + 0.15);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.26);
    } catch (e) {
      console.warn('[KitaCom] Gagal memainkan Busy Tone:', e);
    }
  }

  /**
   * Pre-flight Volume Guard (Double Chirp 1200Hz - 1600Hz)
   * Berbunyi saat Mode Siaga diaktifkan untuk memastikan speaker menyala
   */
  static async playPreflightGuard(ctx: AudioContext) {
    try {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const now = ctx.currentTime + 0.04;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.setValueAtTime(1600, now + 0.11);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.6, now + 0.015);
      gain.gain.setValueAtTime(0.6, now + 0.09);
      gain.gain.setValueAtTime(0.01, now + 0.1);
      gain.gain.setValueAtTime(0.6, now + 0.12);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.21);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.23);
    } catch (e) {
      console.warn('[KitaCom] Gagal memainkan Preflight Chirp:', e);
    }
  }

  /**
   * Emergency Siren: Sapuan frekuensi 800Hz -> 1500Hz berulang
   * Dipicu saat Komandan mengirim tanda bahaya
   */
  static async playEmergencySiren(ctx: AudioContext) {
    try {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const now = ctx.currentTime + 0.04;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      
      // Sweep 800Hz ke 1500Hz lalu turun
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.linearRampToValueAtTime(1500, now + 0.35);
      osc.frequency.linearRampToValueAtTime(800, now + 0.7);
      osc.frequency.linearRampToValueAtTime(1500, now + 1.05);
      osc.frequency.linearRampToValueAtTime(800, now + 1.4);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.5, now + 0.02);
      gain.gain.setValueAtTime(0.5, now + 1.4);
      gain.gain.linearRampToValueAtTime(0.001, now + 1.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 1.55);
    } catch (e) {
      console.warn('[KitaCom] Gagal memainkan Emergency Siren:', e);
    }
  }
}
