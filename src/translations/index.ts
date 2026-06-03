import english from "./english.json";
import polish from "./polish.json";

export type Language = "english" | "polish";
export type Translation = typeof english;

export const translations: Record<Language, Translation> = {
  english,
  polish,
};

