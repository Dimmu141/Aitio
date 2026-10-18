/** The fixed tag vocabulary (Show-Score style). Free text would need moderation and can't be translated. */
export const TAGS = [
  { slug: "moving", labelFi: "Koskettava", labelSv: "Berörande", labelEn: "Moving" },
  { slug: "funny", labelFi: "Hauska", labelSv: "Rolig", labelEn: "Funny" },
  { slug: "thought-provoking", labelFi: "Ajatuksia herättävä", labelSv: "Tankeväckande", labelEn: "Thought-provoking" },
  { slug: "gripping", labelFi: "Mukaansatempaava", labelSv: "Gripande", labelEn: "Gripping" },
  { slug: "great-acting", labelFi: "Upeat roolisuoritukset", labelSv: "Starka rollprestationer", labelEn: "Great acting" },
  { slug: "stunning-visuals", labelFi: "Visuaalisesti upea", labelSv: "Visuellt slående", labelEn: "Stunning visuals" },
  { slug: "great-music", labelFi: "Hieno musiikki", labelSv: "Fin musik", labelEn: "Great music" },
  { slug: "bold", labelFi: "Rohkea", labelSv: "Modig", labelEn: "Bold" },
  { slug: "family-friendly", labelFi: "Sopii koko perheelle", labelSv: "Passar hela familjen", labelEn: "Family friendly" },
  { slug: "first-timers", labelFi: "Hyvä ensikertalaiselle", labelSv: "Bra för nybörjare", labelEn: "Good for first-timers" },
  { slug: "too-long", labelFi: "Liian pitkä", labelSv: "För lång", labelEn: "Too long" },
  { slug: "confusing", labelFi: "Sekava", labelSv: "Förvirrande", labelEn: "Confusing" },
] as const;

export const MAX_TAGS_PER_ENTRY = 3;
