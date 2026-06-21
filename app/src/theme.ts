export const theme = {
  colors: {
    bg: "#0B0F14",
    surface: "#161C24",
    surfaceAlt: "#1F2730",
    text: "#E6EDF3",
    textDim: "#8B98A5",
    accent: "#FF5A1F", // energetic orange
    accentDim: "#7A2E10",
    user: "#214E34",
    coach: "#1F2730",
    danger: "#E5484D",
  },
  radius: 16,
  spacing: (n: number) => n * 8,
} as const;
