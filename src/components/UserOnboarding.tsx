import React, { useState, useMemo } from 'react';
import { createAvatar } from '@dicebear/core';
import { lorelei, avataaars, bottts, micah, personas, adventurer } from '@dicebear/collection';
import { User } from '../types';
import { RefreshCw, Sliders, Shuffle, ChevronDown, ChevronUp } from 'lucide-react';

interface UserOnboardingProps {
  onComplete: (user: Omit<User, 'id'>) => void;
  isCreator?: boolean;
}

// Type for available avatar styles
type AvatarStyle = 'lorelei' | 'avataaars' | 'bottts' | 'micah' | 'personas' | 'adventurer';

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

function UserOnboarding({ onComplete, isCreator = false }: UserOnboardingProps) {
  const [name, setName] = useState('');
  const [seed, setSeed] = useState(() => Math.random().toString(36).substring(7));
  const [showCustomization, setShowCustomization] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<AvatarStyle>('lorelei');
  
  // Customization options
  const [hairColor, setHairColor] = useState(HAIR_COLORS[0].value);
  const [skinColor, setSkinColor] = useState(SKIN_COLORS[0].value);
  const [hairStyle, setHairStyle] = useState<string | null>(null);
  const [eyes, setEyes] = useState<string | null>(null);
  const [mouth, setMouth] = useState<string | null>(null);
  const [glasses, setGlasses] = useState(false);
  const [beard, setBeard] = useState(false);
  const [earrings, setEarrings] = useState(false);

  // Style-specific options based on the selected avatar style
  const styleOptions = useMemo(() => {
    switch (selectedStyle) {
      case 'lorelei':
        return {
          hairStyles: Array.from({ length: 48 }, (_, i) => `variant${String(i + 1).padStart(2, '0')}`),
          eyeStyles: Array.from({ length: 24 }, (_, i) => `variant${String(i + 1).padStart(2, '0')}`),
          mouthStyles: [
            ...Array.from({ length: 18 }, (_, i) => `happy${String(i + 1).padStart(2, '0')}`),
            ...Array.from({ length: 9 }, (_, i) => `sad${String(i + 1).padStart(2, '0')}`)
          ],
          hasGlasses: true,
          hasBeard: true,
          hasEarrings: true,
        };
      case 'avataaars':
        return {
          hairStyles: ['longHair', 'shortHair', 'eyepatch', 'hat', 'hijab', 'turban'],
          eyeStyles: ['default', 'eyeRoll', 'happy', 'side', 'squint', 'surprised', 'wink', 'winkWacky'],
          mouthStyles: ['default', 'eating', 'grimace', 'sad', 'screamOpen', 'serious', 'smile', 'tongue', 'twinkle'],
          hasGlasses: true,
          hasBeard: true,
          hasEarrings: false,
        };
      case 'bottts':
        return {
          hairStyles: ['antenna01', 'antenna02', 'cables01', 'cables02', 'round', 'square'],
          eyeStyles: ['bulging', 'dizzy', 'eva', 'frame1', 'frame2', 'glow', 'happy', 'hearts', 'robocop', 'round', 'roundFrame01', 'roundFrame02', 'sensor', 'shade01'],
          mouthStyles: ['bite', 'diagram', 'grill01', 'grill02', 'grill03', 'smile01', 'smile02', 'square01', 'square02'],
          hasGlasses: false,
          hasBeard: false,
          hasEarrings: false,
        };
      case 'micah':
        return {
          hairStyles: ['variant01', 'variant02', 'variant03', 'variant04', 'variant05'],
          eyeStyles: ['variant01', 'variant02', 'variant03', 'variant04', 'variant05'],
          mouthStyles: ['variant01', 'variant02', 'variant03', 'variant04', 'variant05'],
          hasGlasses: true,
          hasBeard: false,
          hasEarrings: true,
        };
      case 'personas':
        return {
          hairStyles: ['short01', 'short02', 'short03', 'short04', 'short05', 'long01', 'long02', 'long03', 'long04'],
          eyeStyles: ['variant01', 'variant02', 'variant03', 'variant04', 'variant05'],
          mouthStyles: ['variant01', 'variant02', 'variant03', 'variant04', 'variant05'],
          hasGlasses: true,
          hasBeard: true,
          hasEarrings: true,
        };
      case 'adventurer':
        return {
          hairStyles: ['short01', 'short02', 'short03', 'long01', 'long02', 'long03', 'bald'],
          eyeStyles: ['variant01', 'variant02', 'variant03', 'variant04', 'variant05'],
          mouthStyles: ['variant01', 'variant02', 'variant03', 'variant04', 'variant05'],
          hasGlasses: true,
          hasBeard: true,
          hasEarrings: true,
        };
      default:
        return {
          hairStyles: [],
          eyeStyles: [],
          mouthStyles: [],
          hasGlasses: false,
          hasBeard: false,
          hasEarrings: false,
        };
    }
  }, [selectedStyle]);

  // Initialize random feature selections when style changes
  useMemo(() => {
    const randomHair = styleOptions.hairStyles[Math.floor(Math.random() * styleOptions.hairStyles.length)];
    const randomEyes = styleOptions.eyeStyles[Math.floor(Math.random() * styleOptions.eyeStyles.length)];
    const randomMouth = styleOptions.mouthStyles[Math.floor(Math.random() * styleOptions.mouthStyles.length)];
    
    setHairStyle(randomHair);
    setEyes(randomEyes);
    setMouth(randomMouth);
    setGlasses(Math.random() > 0.7 && styleOptions.hasGlasses);
    setBeard(Math.random() > 0.8 && styleOptions.hasBeard);
    setEarrings(Math.random() > 0.9 && styleOptions.hasEarrings);
  }, [selectedStyle, styleOptions]);

  const generateAvatar = (seed: string) => {
    let options = {
      seed,
      size: 128,
    };
    
    // Add style-specific customizations
    if (showCustomization) {
      switch (selectedStyle) {
        case 'lorelei':
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
          break;
        case 'avataaars':
          options = {
            ...options,
            hair: hairStyle ? [hairStyle] : undefined,
            hairColor: [hairColor],
            skinColor: [skinColor],
            eyes: eyes ? [eyes] : undefined,
            mouth: mouth ? [mouth] : undefined,
            accessories: glasses ? ['kurt'] : [],
            accessoriesProbability: glasses ? 100 : 0,
            facialHair: beard ? ['medium'] : [],
            facialHairProbability: beard ? 100 : 0,
          };
          break;
        case 'bottts':
          options = {
            ...options,
            head: hairStyle ? [hairStyle] : undefined,
            eyes: eyes ? [eyes] : undefined,
            mouth: mouth ? [mouth] : undefined,
            colorful: true,
          };
          break;
        case 'micah':
        case 'personas':
        case 'adventurer':
          options = {
            ...options,
            hair: hairStyle ? [hairStyle] : undefined,
            hairColor: [hairColor],
            skinColor: [skinColor],
            eyes: eyes ? [eyes] : undefined,
            mouth: mouth ? [mouth] : undefined,
            glasses: glasses ? ['variant01'] : [],
            glassesProbability: glasses ? 100 : 0,
            beard: beard && styleOptions.hasBeard ? ['variant01'] : [],
            beardProbability: beard && styleOptions.hasBeard ? 100 : 0,
            earrings: earrings && styleOptions.hasEarrings ? ['variant01'] : [],
            earringsProbability: earrings && styleOptions.hasEarrings ? 100 : 0,
          };
          break;
      }
    }

    // Create avatar based on selected style
    let avatar;
    switch (selectedStyle) {
      case 'lorelei':
        avatar = createAvatar(lorelei, options);
        break;
      case 'avataaars':
        avatar = createAvatar(avataaars, options);
        break;
      case 'bottts':
        avatar = createAvatar(bottts, options);
        break;
      case 'micah':
        avatar = createAvatar(micah, options);
        break;
      case 'personas':
        avatar = createAvatar(personas, options);
        break;
      case 'adventurer':
        avatar = createAvatar(adventurer, options);
        break;
      default:
        avatar = createAvatar(lorelei, options);
    }
    
    return avatar.toDataUriSync();
  };

  const regenerateAvatar = () => {
    setSeed(Math.random().toString(36).substring(7));
  };

  const randomizeAllFeatures = () => {
    // Set a new random seed
    setSeed(Math.random().toString(36).substring(7));
    
    // Randomize all features
    setHairColor(HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)].value);
    setSkinColor(SKIN_COLORS[Math.floor(Math.random() * SKIN_COLORS.length)].value);
    
    const randomHair = styleOptions.hairStyles[Math.floor(Math.random() * styleOptions.hairStyles.length)];
    const randomEyes = styleOptions.eyeStyles[Math.floor(Math.random() * styleOptions.eyeStyles.length)];
    const randomMouth = styleOptions.mouthStyles[Math.floor(Math.random() * styleOptions.mouthStyles.length)];
    
    setHairStyle(randomHair);
    setEyes(randomEyes);
    setMouth(randomMouth);
    setGlasses(Math.random() > 0.7 && styleOptions.hasGlasses);
    setBeard(Math.random() > 0.8 && styleOptions.hasBeard);
    setEarrings(Math.random() > 0.9 && styleOptions.hasEarrings);
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
              
              {/* Style selector */}
              <div className="w-full">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Avatar Style
                </label>
                <select
                  value={selectedStyle}
                  onChange={(e) => setSelectedStyle(e.target.value as AvatarStyle)}
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                >
                  <option value="lorelei">Lorelei</option>
                  <option value="avataaars">Avataaars</option>
                  <option value="bottts">Bottts (Robot)</option>
                  <option value="micah">Micah</option>
                  <option value="personas">Personas</option>
                  <option value="adventurer">Adventurer</option>
                </select>
              </div>
              
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
                      {styleOptions.hairStyles.map((style) => (
                        <option key={style} value={style}>
                          {style}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Hair color (for styles that support it) */}
                  {selectedStyle !== 'bottts' && (
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
                  )}
                  
                  {/* Skin color (for styles that support it) */}
                  {selectedStyle !== 'bottts' && (
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
                  )}
                  
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
                      {styleOptions.eyeStyles.map((style) => (
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
                      {styleOptions.mouthStyles.map((style) => (
                        <option key={style} value={style}>
                          {style}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Feature toggles */}
                  <div className="flex flex-wrap gap-4">
                    {styleOptions.hasGlasses && (
                      <label className="flex items-center text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={glasses}
                          onChange={() => setGlasses(!glasses)}
                          className="mr-2 h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                        />
                        Glasses
                      </label>
                    )}
                    
                    {styleOptions.hasBeard && (
                      <label className="flex items-center text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={beard}
                          onChange={() => setBeard(!beard)}
                          className="mr-2 h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                        />
                        Beard
                      </label>
                    )}
                    
                    {styleOptions.hasEarrings && (
                      <label className="flex items-center text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={earrings}
                          onChange={() => setEarrings(!earrings)}
                          className="mr-2 h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                        />
                        Earrings
                      </label>
                    )}
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