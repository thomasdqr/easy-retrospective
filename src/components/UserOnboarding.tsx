import React, { useState, useEffect, useCallback } from 'react';
import { createAvatar } from '@dicebear/core';
import { lorelei } from '@dicebear/collection';
import { User } from '../types';
import { Sliders, Shuffle, ChevronDown, ChevronUp } from 'lucide-react';

interface UserOnboardingProps {
  onComplete: (user: Omit<User, 'id'>) => void;
  isCreator?: boolean;
}

// Avatar customization interface for localStorage
interface AvatarCustomization {
  seed: string;
  hairColor: string;
  skinColor: string;
  hairStyle: string | null;
  eyes: string | null;
  mouth: string | null;
  glasses: boolean;
  beard: boolean;
  earrings: boolean;
}

// localStorage key for avatar customization
const AVATAR_CUSTOMIZATION_KEY = 'avatar_customization';

// Hair color options
const HAIR_COLORS = [
  { name: 'Black', value: '000000' },
  { name: 'Brown', value: '6b4f3f' },
  { name: 'Blonde', value: 'e0bb94' },
  { name: 'Red', value: 'a52f10' },
  { name: 'Gray', value: 'aaaaaa' },
  { name: 'Blue', value: '1e00ff' },
  { name: 'Pink', value: 'ff00e3' },
  { name: 'Green', value: '00ff85' },
];

// Skin color options
const SKIN_COLORS = [
  { name: 'Light', value: 'ffdbac' },
  { name: 'Medium', value: 'f1c27d' },
  { name: 'Tan', value: 'e0ac69' },
  { name: 'Brown', value: 'c68642' },
  { name: 'Dark', value: '8d5524' },
];

// Lorelei style options
const HAIR_STYLES = Array.from({ length: 48 }, (_, i) => `variant${String(i + 1).padStart(2, '0')}`);
const EYE_STYLES = Array.from({ length: 24 }, (_, i) => `variant${String(i + 1).padStart(2, '0')}`);
const MOUTH_STYLES = [
  ...Array.from({ length: 18 }, (_, i) => `happy${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 9 }, (_, i) => `sad${String(i + 1).padStart(2, '0')}`)
];

function UserOnboarding({ onComplete, isCreator = false }: UserOnboardingProps) {
  const [name, setName] = useState('');
  const [seed, setSeed] = useState(() => Math.random().toString(36).substring(7));
  const [showCustomization, setShowCustomization] = useState(false);
  
  // Customization options
  const [hairColor, setHairColor] = useState(HAIR_COLORS[0].value);
  const [skinColor, setSkinColor] = useState(SKIN_COLORS[0].value);
  const [hairStyle, setHairStyle] = useState<string | null>(null);
  const [eyes, setEyes] = useState<string | null>(null);
  const [mouth, setMouth] = useState<string | null>(null);
  const [glasses, setGlasses] = useState(false);
  const [beard, setBeard] = useState(false);
  const [earrings, setEarrings] = useState(false);
  
  // Flag to prevent localStorage save on initial load
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Load saved avatar customization from localStorage on initial render
  useEffect(() => {
    try {
      const savedCustomization = localStorage.getItem(AVATAR_CUSTOMIZATION_KEY);
      if (savedCustomization) {
        const customization: AvatarCustomization = JSON.parse(savedCustomization);
        
        setSeed(customization.seed);
        setHairColor(customization.hairColor);
        setSkinColor(customization.skinColor);
        setHairStyle(customization.hairStyle);
        setEyes(customization.eyes);
        setMouth(customization.mouth);
        setGlasses(customization.glasses);
        setBeard(customization.beard);
        setEarrings(customization.earrings);
        
        // Don't show customization panel by default, even with saved settings
      }
      
      // Mark initial load as complete after setting state
      setInitialLoadComplete(true);
    } catch (error) {
      console.error('Error loading avatar customization from localStorage:', error);
      // If there's an error, we'll just use the default random avatar
      setInitialLoadComplete(true);
    }
  }, []);

  // Save avatar customization to localStorage when options change, but only after initial load
  useEffect(() => {
    // Skip saving during the initial load to prevent render loops
    if (!initialLoadComplete) return;
    
    const customization: AvatarCustomization = {
      seed,
      hairColor,
      skinColor,
      hairStyle,
      eyes,
      mouth,
      glasses,
      beard,
      earrings
    };
    
    localStorage.setItem(AVATAR_CUSTOMIZATION_KEY, JSON.stringify(customization));
  }, [
    initialLoadComplete,
    seed,
    hairColor,
    skinColor,
    hairStyle,
    eyes,
    mouth,
    glasses,
    beard,
    earrings
  ]);

  // Initialize random feature selections when style changes
  useEffect(() => {
    // Only initialize if there's no saved customization or if hairStyle is null
    if (initialLoadComplete && (!localStorage.getItem(AVATAR_CUSTOMIZATION_KEY) || hairStyle === null)) {
      const randomHair = HAIR_STYLES[Math.floor(Math.random() * HAIR_STYLES.length)];
      const randomEyes = EYE_STYLES[Math.floor(Math.random() * EYE_STYLES.length)];
      const randomMouth = MOUTH_STYLES[Math.floor(Math.random() * MOUTH_STYLES.length)];
      
      setHairStyle(randomHair);
      setEyes(randomEyes);
      setMouth(randomMouth);
      setGlasses(Math.random() > 0.7);
      setBeard(Math.random() > 0.8);
      setEarrings(Math.random() > 0.9);
    }
  }, [hairStyle, initialLoadComplete]);

  // Memoize avatar generation to prevent unnecessary re-renders
  const generateAvatar = useCallback((seed: string) => {
    // Type for avatar options allowing any property
    type AvatarOptions = {
      seed: string;
      size: number;
      [key: string]: unknown;
    };
    
    let options: AvatarOptions = {
      seed,
      size: 128,
    };
    
    // Add style-specific customizations
    if (hairStyle || hairColor || skinColor || eyes || mouth || glasses || beard || earrings) {
      options = {
        ...options,
        hair: hairStyle ? [hairStyle] : undefined,
        hairColor: [hairColor],
        skinColor: [skinColor],
        eyes: eyes ? [eyes] : undefined,
        mouth: mouth ? [mouth] : undefined,
        glasses: glasses ? ['variant01'] : [],
        glassesProbability: glasses ? 100 : 0,
        beard: beard ? ['variant01'] : [],
        beardProbability: beard ? 100 : 0,
        earrings: earrings ? ['variant01'] : [],
        earringsProbability: earrings ? 100 : 0,
      };
    }

    const avatar = createAvatar(lorelei, options);
    return avatar.toDataUriSync();
  }, [
    hairStyle, 
    hairColor, 
    skinColor, 
    eyes, 
    mouth, 
    glasses, 
    beard, 
    earrings
  ]);

  const randomizeAllFeatures = () => {
    // Set a new random seed
    setSeed(Math.random().toString(36).substring(7));
    
    // Randomize all features
    setHairColor(HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)].value);
    setSkinColor(SKIN_COLORS[Math.floor(Math.random() * SKIN_COLORS.length)].value);
    
    const randomHair = HAIR_STYLES[Math.floor(Math.random() * HAIR_STYLES.length)];
    const randomEyes = EYE_STYLES[Math.floor(Math.random() * EYE_STYLES.length)];
    const randomMouth = MOUTH_STYLES[Math.floor(Math.random() * MOUTH_STYLES.length)];
    
    setHairStyle(randomHair);
    setEyes(randomEyes);
    setMouth(randomMouth);
    setGlasses(Math.random() > 0.7);
    setBeard(Math.random() > 0.8);
    setEarrings(Math.random() > 0.9);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onComplete({
        name: name.trim(),
        avatar: generateAvatar(seed),
        isCreator
      });
    }
  };

  // Function to reset avatar customization
  const resetAvatarCustomization = () => {
    localStorage.removeItem(AVATAR_CUSTOMIZATION_KEY);
    randomizeAllFeatures();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 to-purple-100 p-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900">
            Join Session
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Enter your name and customize your avatar
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Your Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
              placeholder="Enter your name"
              required
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Your Avatar
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={randomizeAllFeatures}
                  className="flex items-center gap-1 py-1 px-2 rounded-md text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
                  title="Generate random avatar"
                >
                  <Shuffle className="w-3 h-3" />
                  Random
                </button>
                <button
                  type="button"
                  onClick={() => setShowCustomization(!showCustomization)}
                  className="flex items-center gap-1 py-1 px-2 rounded-md text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
                >
                  <Sliders className="w-3 h-3" />
                  {showCustomization ? "Hide Options" : "Customize"}
                  {showCustomization ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>
            </div>
            
            <div className="flex flex-col items-center gap-4 p-4 border rounded-lg bg-gray-50">
              <img
                src={generateAvatar(seed)}
                alt="Avatar"
                className="w-32 h-32 rounded-full bg-white shadow-sm"
              />
              
              {/* Customization options */}
              {showCustomization && (
                <div className="w-full space-y-4 mt-2">
                  {/* Hair style */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Hair Style
                    </label>
                    <select
                      value={hairStyle || ''}
                      onChange={(e) => setHairStyle(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                    >
                      {HAIR_STYLES.map((style) => (
                        <option key={style} value={style}>
                          {style}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Hair color */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Hair Color
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {HAIR_COLORS.map((color) => (
                        <button
                          key={color.value}
                          type="button"
                          className={`w-full h-8 rounded-md border ${hairColor === color.value ? 'ring-2 ring-indigo-500' : 'border-gray-300'}`}
                          style={{ backgroundColor: `#${color.value}` }}
                          onClick={() => setHairColor(color.value)}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Skin color */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Skin Color
                    </label>
                    <div className="grid grid-cols-5 gap-2">
                      {SKIN_COLORS.map((color) => (
                        <button
                          key={color.value}
                          type="button"
                          className={`w-full h-8 rounded-md border ${skinColor === color.value ? 'ring-2 ring-indigo-500' : 'border-gray-300'}`}
                          style={{ backgroundColor: `#${color.value}` }}
                          onClick={() => setSkinColor(color.value)}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Eyes */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Eyes
                    </label>
                    <select
                      value={eyes || ''}
                      onChange={(e) => setEyes(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                    >
                      {EYE_STYLES.map((style) => (
                        <option key={style} value={style}>
                          {style}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Mouth */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Mouth
                    </label>
                    <select
                      value={mouth || ''}
                      onChange={(e) => setMouth(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                    >
                      {MOUTH_STYLES.map((style) => (
                        <option key={style} value={style}>
                          {style}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Feature toggles */}
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={glasses}
                        onChange={() => setGlasses(!glasses)}
                        className="mr-2 h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                      />
                      Glasses
                    </label>
                    
                    <label className="flex items-center text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={beard}
                        onChange={() => setBeard(!beard)}
                        className="mr-2 h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                      />
                      Beard
                    </label>
                    
                    <label className="flex items-center text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={earrings}
                        onChange={() => setEarrings(!earrings)}
                        className="mr-2 h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                      />
                      Earrings
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            Join Session
          </button>
        </form>
      </div>
    </div>
  );
}

export default UserOnboarding;