import type { AdminLineageDog } from "@/lib/admin-portal";

export const BREEDING_PROGRAM_SCHEMA_VERSION = "2026-04-12";

export const BREEDING_DOG_STATUS_OPTIONS = [
  "Prospect",
  "Active",
  "Paused",
  "Pregnant",
  "Nursing",
  "Recovering",
  "Retired",
  "Deceased",
  "Sold",
  "Pet Home",
  "Archived",
] as const;

export const BREEDING_PROGRAM_STATE_OPTIONS = [
  "Program Ready",
  "On Hold",
  "Breeding Window",
  "Pregnant",
  "Nursing",
  "Recovering",
  "Retired",
] as const;

export const BREEDING_ELIGIBILITY_OPTIONS = [
  "Eligible",
  "Too Young",
  "On Hold",
  "Health Hold",
  "Recovering",
  "Retired",
] as const;

export const BREEDING_PROVEN_OPTIONS = [
  "Unproven",
  "Proven",
  "Retained Offspring",
  "Prospect",
  "Retired",
] as const;

export const BREEDING_VALUE_TIER_OPTIONS = [
  "Foundation",
  "Priority",
  "Growth",
  "Watch",
  "Legacy",
] as const;

export type BreedingProgramMetadata = {
  profile: {
    internalId: string;
    registeredName: string;
    microchip: string;
    registrationNumber: string;
    weight: string;
    valueTier: string;
    breedingEligibility: string;
    provenStatus: string;
    currentProgramState: string;
    ageAtFirstBreeding: string;
    retirementTarget: string;
    retirementDate: string;
    sourceBreeder: string;
    photoUrls: string;
    freeformNotes: string;
  };
  lineage: {
    sireName: string;
    damName: string;
    bloodlineLabel: string;
    bloodlineNotes: string;
    pedigreeSummary: string;
    relatedDogNames: string;
    pairingCompatibilityNotes: string;
  };
  health: {
    generalNotes: string;
    vaccinationLog: string;
    vetHistory: string;
    weightHistory: string;
    reproductiveHealthNotes: string;
    testingSummary: string;
    screeningSummary: string;
    conditions: string;
    restrictions: string;
    emergencyWarnings: string;
  };
  genetics: {
    coatGenetics: string;
    colorGenetics: string;
    dnaResults: string;
    carrierStates: string;
    compatibilityNotes: string;
    riskyPairingWarnings: string;
    documentLinks: string;
    rawLabNotes: string;
  };
  reproduction: {
    lastHeatDate: string;
    expectedNextHeat: string;
    breedingWindow: string;
    ovulationNotes: string;
    heatCycleHistory: string;
    matingAttempts: string;
    pregnancyConfirmedDate: string;
    dueDate: string;
    whelpDate: string;
    recoveryNotes: string;
    nextBreedingWindow: string;
    fertilityNotes: string;
    breedingCountNotes: string;
    maleObservationNotes: string;
    collectionNotes: string;
  };
  admin: {
    reminders: string;
    alertNotes: string;
    incompleteRecordNotes: string;
    programRecommendations: string;
  };
};

type StoredNotesPayload = {
  schema_version?: string;
  profile?: Partial<BreedingProgramMetadata["profile"]>;
  lineage?: Partial<BreedingProgramMetadata["lineage"]>;
  health?: Partial<BreedingProgramMetadata["health"]>;
  reproduction?: Partial<BreedingProgramMetadata["reproduction"]>;
  admin?: Partial<BreedingProgramMetadata["admin"]>;
};

type StoredGeneticsPayload = {
  schema_version?: string;
  genetics?: Partial<BreedingProgramMetadata["genetics"]>;
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseJsonRecord(value: string | null | undefined) {
  const raw = text(value);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return asRecord(parsed);
  } catch {
    return null;
  }
}

function mergeSection<T extends Record<string, string>>(
  base: T,
  patch: Partial<Record<keyof T, unknown>> | null | undefined
) {
  if (!patch) return base;

  const next = { ...base };
  for (const key of Object.keys(base) as Array<keyof T>) {
    const value = patch[key];
    if (value == null) continue;
    next[key] = text(value) as T[keyof T];
  }
  return next;
}

export function emptyBreedingProgramMetadata(): BreedingProgramMetadata {
  return {
    profile: {
      internalId: "",
      registeredName: "",
      microchip: "",
      registrationNumber: "",
      weight: "",
      valueTier: "",
      breedingEligibility: "",
      provenStatus: "",
      currentProgramState: "",
      ageAtFirstBreeding: "",
      retirementTarget: "",
      retirementDate: "",
      sourceBreeder: "",
      photoUrls: "",
      freeformNotes: "",
    },
    lineage: {
      sireName: "",
      damName: "",
      bloodlineLabel: "",
      bloodlineNotes: "",
      pedigreeSummary: "",
      relatedDogNames: "",
      pairingCompatibilityNotes: "",
    },
    health: {
      generalNotes: "",
      vaccinationLog: "",
      vetHistory: "",
      weightHistory: "",
      reproductiveHealthNotes: "",
      testingSummary: "",
      screeningSummary: "",
      conditions: "",
      restrictions: "",
      emergencyWarnings: "",
    },
    genetics: {
      coatGenetics: "",
      colorGenetics: "",
      dnaResults: "",
      carrierStates: "",
      compatibilityNotes: "",
      riskyPairingWarnings: "",
      documentLinks: "",
      rawLabNotes: "",
    },
    reproduction: {
      lastHeatDate: "",
      expectedNextHeat: "",
      breedingWindow: "",
      ovulationNotes: "",
      heatCycleHistory: "",
      matingAttempts: "",
      pregnancyConfirmedDate: "",
      dueDate: "",
      whelpDate: "",
      recoveryNotes: "",
      nextBreedingWindow: "",
      fertilityNotes: "",
      breedingCountNotes: "",
      maleObservationNotes: "",
      collectionNotes: "",
    },
    admin: {
      reminders: "",
      alertNotes: "",
      incompleteRecordNotes: "",
      programRecommendations: "",
    },
  };
}

export function parseBreedingProgramMetadata(
  dog: Pick<
    AdminLineageDog,
    | "notes"
    | "genetics_raw"
    | "name"
    | "displayName"
    | "display_name"
    | "dog_name"
    | "status"
    | "genetics_report_url"
    | "genetics_summary"
  > | null
): BreedingProgramMetadata {
  const base = emptyBreedingProgramMetadata();
  const notesRecord = parseJsonRecord(dog?.notes);
  const geneticsRecord = parseJsonRecord(dog?.genetics_raw);

  const noteSections = (notesRecord || {}) as StoredNotesPayload;
  const geneticsSections = (geneticsRecord || {}) as StoredGeneticsPayload;

  const profile = mergeSection(base.profile, noteSections.profile);
  const lineage = mergeSection(base.lineage, noteSections.lineage);
  const health = mergeSection(base.health, noteSections.health);
  const reproduction = mergeSection(base.reproduction, noteSections.reproduction);
  const admin = mergeSection(base.admin, noteSections.admin);
  const genetics = mergeSection(base.genetics, geneticsSections.genetics);

  if (!notesRecord && text(dog?.notes)) {
    profile.freeformNotes = text(dog?.notes);
  }

  if (!geneticsRecord && text(dog?.genetics_raw)) {
    genetics.rawLabNotes = text(dog?.genetics_raw);
  }

  if (!profile.registeredName) {
    profile.registeredName =
      text(dog?.name) ||
      text(dog?.dog_name) ||
      text(dog?.displayName) ||
      text(dog?.display_name);
  }

  if (!profile.currentProgramState) {
    profile.currentProgramState = text(dog?.status);
  }

  if (!genetics.documentLinks) {
    genetics.documentLinks = text(dog?.genetics_report_url);
  }

  return {
    profile,
    lineage,
    health,
    genetics: {
      ...genetics,
      rawLabNotes: genetics.rawLabNotes,
    },
    reproduction,
    admin,
  };
}

export function serializeBreedingProgramNotes(
  metadata: BreedingProgramMetadata
) {
  const payload: StoredNotesPayload = {
    schema_version: BREEDING_PROGRAM_SCHEMA_VERSION,
    profile: metadata.profile,
    lineage: metadata.lineage,
    health: metadata.health,
    reproduction: metadata.reproduction,
    admin: metadata.admin,
  };

  return JSON.stringify(payload, null, 2);
}

export function serializeBreedingProgramGenetics(
  metadata: BreedingProgramMetadata
) {
  const payload: StoredGeneticsPayload = {
    schema_version: BREEDING_PROGRAM_SCHEMA_VERSION,
    genetics: metadata.genetics,
  };

  return JSON.stringify(payload, null, 2);
}

export function breedingStatusGroup(value: string | null | undefined) {
  const normalized = text(value).toLowerCase();
  if (!normalized) return "active";
  if (normalized.includes("prospect")) return "prospect";
  if (normalized.includes("retire")) return "retired";
  if (normalized.includes("deceased") || normalized.includes("passed")) return "deceased";
  if (normalized.includes("sold")) return "sold";
  if (normalized.includes("pet")) return "pet_home";
  if (normalized.includes("paused") || normalized.includes("hold")) return "paused";
  if (normalized.includes("pregnant")) return "pregnant";
  if (normalized.includes("nursing")) return "nursing";
  if (normalized.includes("recover")) return "recovering";
  if (normalized.includes("archive")) return "archived";
  return "active";
}

export function breedingStatusIsInactive(value: string | null | undefined) {
  return ["retired", "deceased", "sold", "pet_home", "archived"].includes(
    breedingStatusGroup(value)
  );
}

export function splitMultilineList(value: string | null | undefined) {
  return text(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function firstPhotoUrl(metadata: BreedingProgramMetadata) {
  return splitMultilineList(metadata.profile.photoUrls)[0] || "";
}
