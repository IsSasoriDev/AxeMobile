import { useCallback, useEffect, useRef } from 'react';

type SoundType = 'mine' | 'find_common' | 'find_rare' | 'find_legendary' | 'purchase' | 'ambient';

const isMuted = () => localStorage.getItem('caveSoundMuted') === 'true';

export const useMiningSound = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const ambientIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Initialize Web Audio API
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();

    // Start ambient cave sounds
    startAmbientSounds();

    return () => {
      stopAmbientSounds();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const playTone = useCallback((frequency: number, duration: number, type: OscillatorType = 'sine') => {
    if (!audioContextRef.current || isMuted()) return;

    const context = audioContextRef.current;
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    
    gainNode.gain.setValueAtTime(0.3, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + duration);

    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + duration);
  }, []);

  const playPickaxeSwing = useCallback(() => {
    if (!audioContextRef.current || isMuted()) return;

    const context = audioContextRef.current;
    
    // Whoosh sound (descending tone)
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(800, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(200, context.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.2, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.15);
    
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.15);

    // Impact sound
    setTimeout(() => {
      playTone(100, 0.05, 'square');
    }, 150);
  }, [playTone]);

  const playOreFound = useCallback((rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary') => {
    if (!audioContextRef.current || isMuted()) return;

    const context = audioContextRef.current;
    
    // Different sounds based on rarity
    const frequencies = {
      common: [200, 250],
      uncommon: [300, 400],
      rare: [400, 550],
      epic: [500, 700, 900],
      legendary: [600, 800, 1000, 1200],
    };

    const freqs = frequencies[rarity];
    freqs.forEach((freq, index) => {
      setTimeout(() => {
        playTone(freq, 0.3, 'sine');
      }, index * 100);
    });

    // Add shimmer for rare+ items
    if (rarity === 'rare' || rarity === 'epic' || rarity === 'legendary') {
      setTimeout(() => {
        for (let i = 0; i < 5; i++) {
          setTimeout(() => {
            playTone(1200 + Math.random() * 400, 0.1, 'sine');
          }, i * 50);
        }
      }, 400);
    }
  }, [playTone]);

  const playPurchaseSound = useCallback(() => {
    // Ascending chime sound
    [400, 500, 600, 800].forEach((freq, index) => {
      setTimeout(() => {
        playTone(freq, 0.2, 'triangle');
      }, index * 80);
    });
  }, [playTone]);

  const playAmbientDrip = useCallback(() => {
    if (!audioContextRef.current || isMuted()) return;
    
    // Random drip sound
    const freq = 800 + Math.random() * 400;
    playTone(freq, 0.05, 'sine');
  }, [playTone]);

  const startAmbientSounds = () => {
    // Random drips every 3-8 seconds
    const scheduleNextDrip = () => {
      const delay = 3000 + Math.random() * 5000;
      ambientIntervalRef.current = setTimeout(() => {
        playAmbientDrip();
        scheduleNextDrip();
      }, delay);
    };
    scheduleNextDrip();
  };

  const stopAmbientSounds = () => {
    if (ambientIntervalRef.current) {
      clearTimeout(ambientIntervalRef.current);
    }
  };

  const playSound = useCallback((type: SoundType, rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary') => {
    switch (type) {
      case 'mine':
        playPickaxeSwing();
        break;
      case 'find_common':
        playOreFound('common');
        break;
      case 'find_rare':
        playOreFound(rarity || 'rare');
        break;
      case 'find_legendary':
        playOreFound('legendary');
        break;
      case 'purchase':
        playPurchaseSound();
        break;
      case 'ambient':
        playAmbientDrip();
        break;
    }
  }, [playPickaxeSwing, playOreFound, playPurchaseSound, playAmbientDrip]);

  return { playSound };
};
