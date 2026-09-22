// Short, plain-language descriptions for common panel analytes. Purely
// informational copy for the trends grid - anything the parser surfaces
// that isn't listed here just gets a generic fallback line, since new
// reports can contain tests we've never seen before.
const DESCRIPTIONS = {
  CREATININE: "A waste product filtered by the kidneys; the main marker of kidney function.",
  EGFR: "Estimated kidney filtration rate, calculated from creatinine, age, and sex.",
  "VITAMIN B12": "Supports red blood cell formation and nerve function.",
  FERRITIN: "Reflects the body's stored iron levels.",
  GGT: "A liver enzyme; elevated levels can indicate liver or bile duct stress.",
  AST: "A liver and muscle enzyme; elevated levels can indicate tissue damage.",
  ALT: "A liver enzyme; the most specific common marker of liver stress.",
  TSH: "Pituitary hormone that regulates thyroid activity.",
  "HEMOGLOBIN A1C": "Average blood sugar over the past ~3 months.",
  TESTOSTERONE: "Primary male sex hormone; also present in smaller amounts in females.",
  HEMOGLOBIN: "The oxygen-carrying protein in red blood cells.",
  HEMATOCRIT: "The proportion of blood volume made up of red blood cells.",
  RBC: "Red blood cell count.",
  MCV: "Mean corpuscular volume - the average size of red blood cells.",
  MCH: "Mean corpuscular hemoglobin - average hemoglobin per red blood cell.",
  MCHC: "Average hemoglobin concentration within red blood cells.",
  RDW: "Red cell distribution width - variation in red blood cell size.",
  WBC: "White blood cell count; the body's infection-fighting cells.",
  PLATELETS: "Cell fragments responsible for blood clotting.",
  MPV: "Mean platelet volume - the average size of platelets.",
  NEUTROPHILS: "The most common white blood cell; first responders to infection.",
  LYMPHOCYTES: "White blood cells central to immune response, including B and T cells.",
  MONOCYTES: "White blood cells that clear debris and support immune response.",
  EOSINOPHILS: "White blood cells involved in allergic response and parasite defense.",
  BASOPHILS: "The least common white blood cell, involved in inflammatory response.",
};

const FALLBACK = "Tracked from your imported reports.";

export function analyteDescription(name) {
  if (!name) return FALLBACK;
  return DESCRIPTIONS[name.toUpperCase()] || FALLBACK;
}
