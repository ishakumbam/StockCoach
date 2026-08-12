// Cute avatar choices. Stored as an id in the user's auth metadata.

export interface Avatar {
  id: string;
  emoji: string;
  label: string;
  bg: string; // tailwind-safe background classes are inlined as hex for simplicity
}

export const AVATARS: Avatar[] = [
  { id: "fox", emoji: "🦊", label: "Fox", bg: "#7c2d12" },
  { id: "panda", emoji: "🐼", label: "Panda", bg: "#1f2937" },
  { id: "koala", emoji: "🐨", label: "Koala", bg: "#374151" },
  { id: "frog", emoji: "🐸", label: "Frog", bg: "#14532d" },
  { id: "penguin", emoji: "🐧", label: "Penguin", bg: "#1e3a8a" },
  { id: "unicorn", emoji: "🦄", label: "Unicorn", bg: "#6b21a8" },
  { id: "cat", emoji: "🐱", label: "Cat", bg: "#78350f" },
  { id: "dog", emoji: "🐶", label: "Dog", bg: "#92400e" },
  { id: "hamster", emoji: "🐹", label: "Hamster", bg: "#9a3412" },
  { id: "owl", emoji: "🦉", label: "Owl", bg: "#3f3f46" },
  { id: "whale", emoji: "🐳", label: "Whale", bg: "#0c4a6e" },
  { id: "bee", emoji: "🐝", label: "Bee", bg: "#713f12" },
  { id: "octopus", emoji: "🐙", label: "Octopus", bg: "#9f1239" },
  { id: "dino", emoji: "🦕", label: "Dino", bg: "#166534" },
  { id: "rocket", emoji: "🚀", label: "Rocket", bg: "#312e81" },
  { id: "bull", emoji: "🐂", label: "Bull", bg: "#065f46" },
];

export function avatarById(id: string | undefined | null): Avatar {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0];
}
