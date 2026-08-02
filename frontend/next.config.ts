import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // KORREKTUR 02.08.: Hier stand ein `env`-Block, der PYTHON_BACKEND_URL beim
  // BUILD fest ins Bundle kompiliert hat. Der Dockerfile setzt die Variable
  // beim Build aber nicht — es griff also immer der hartcodierte Rückfall auf
  // die öffentliche exquisite-rejoicing-Adresse, und die in Railway gesetzte
  // interne Adresse wurde zur Laufzeit NIEMALS gelesen.
  // Bewiesen am kompilierten Bundle: dort stand statt eines env-Zugriffs ein
  // fester Textwert ("PYTHON_BACKEND_NEW_URL ?? \"...\" ?? \"\"").
  // Ohne diesen Block wird die Variable wie jede andere zur Laufzeit gelesen.
  // Geprüft: alle 16 Nutzer sind serverseitig, keine Client-Komponente ist auf
  // das Einkompilieren angewiesen.
};

export default nextConfig;
