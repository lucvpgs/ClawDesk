"use client";

/**
 * SkillUpdater — runs once at app startup.
 * Checks if the bundled ClawDesk skill version differs from the installed one.
 * If so, silently calls POST /api/skill/install to update it.
 * No UI — fully transparent to the user.
 */

import { useEffect } from "react";

export function SkillUpdater() {
  useEffect(() => {
    fetch("/api/skill/status")
      .then((r) => r.json())
      .then((data) => {
        if (data.needsUpdate || !data.fileInstalled) {
          fetch("/api/skill/install", { method: "POST" }).catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  return null;
}
