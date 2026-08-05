/* AI-ASSISTED: portions of this file were written with the help of an AI assistant (Claude), per course policy. */
/* decay-data.js: a curated set of nuclides for the Nuclide Decay experiment.
   Half-lives are published values. Decay chains are shortened to their named
   major steps, which is stated on the page.

   z    protons
   n    neutrons
   hl   half-life as displayed text
   mode alpha | beta- | beta+ | it | stable
   chain the simplified series this nuclide walks down
   note  one line on why this nuclide is worth knowing */

var FZ_NUCLIDES = [
  { id: "h3",    sym: "H",  a: 3,   z: 1,  n: 2,   hl: "12.32 years",        mode: "beta-",
    chain: ["H-3", "He-3 (stable)"],
    note: "Tritium. Used in self-powered exit signs and glow vials." },

  { id: "c12",   sym: "C",  a: 12,  z: 6,  n: 6,   hl: "stable",             mode: "stable",
    chain: ["C-12 (stable)"],
    note: "The control. Press play and nothing happens, which is the point." },

  { id: "c14",   sym: "C",  a: 14,  z: 6,  n: 8,   hl: "5,730 years",        mode: "beta-",
    chain: ["C-14", "N-14 (stable)"],
    note: "Radiocarbon dating. Made in the atmosphere, taken up by everything alive." },

  { id: "n13",   sym: "N",  a: 13,  z: 7,  n: 6,   hl: "9.97 minutes",       mode: "beta+",
    chain: ["N-13", "C-13 (stable)"],
    note: "A positron emitter, made in a cyclotron and used the same hour." },

  { id: "f18",   sym: "F",  a: 18,  z: 9,  n: 9,   hl: "109.8 minutes",      mode: "beta+",
    chain: ["F-18", "O-18 (stable)"],
    note: "The tracer behind a PET scan. Short enough to leave you quickly." },

  { id: "na22",  sym: "Na", a: 22,  z: 11, n: 11,  hl: "2.60 years",         mode: "beta+",
    chain: ["Na-22", "Ne-22 (stable)"],
    note: "A lab calibration source, and a reliable way to make positrons." },

  { id: "p32",   sym: "P",  a: 32,  z: 15, n: 17,  hl: "14.27 days",         mode: "beta-",
    chain: ["P-32", "S-32 (stable)"],
    note: "Used to label DNA in molecular biology, back when film was the detector." },

  { id: "k40",   sym: "K",  a: 40,  z: 19, n: 21,  hl: "1.25 billion years", mode: "beta-",
    chain: ["K-40", "Ca-40 (stable)"],
    note: "In every banana, and in you. The most common radioactive atom in a human body." },

  { id: "fe56",  sym: "Fe", a: 56,  z: 26, n: 30,  hl: "stable",             mode: "stable",
    chain: ["Fe-56 (stable)"],
    note: "The most tightly bound nucleus there is. Fusion stops paying here." },

  { id: "co60",  sym: "Co", a: 60,  z: 27, n: 33,  hl: "5.27 years",         mode: "beta-",
    chain: ["Co-60", "Ni-60 (stable)"],
    note: "Sterilizes medical equipment and treats tumors. A serious gamma source." },

  { id: "ni63",  sym: "Ni", a: 63,  z: 28, n: 35,  hl: "101.2 years",        mode: "beta-",
    chain: ["Ni-63", "Cu-63 (stable)"],
    note: "A weak beta emitter, which makes it useful in tiny long-life batteries." },

  { id: "kr85",  sym: "Kr", a: 85,  z: 36, n: 49,  hl: "10.76 years",        mode: "beta-",
    chain: ["Kr-85", "Rb-85 (stable)"],
    note: "A noble gas that still decays. Released by fuel reprocessing." },

  { id: "sr90",  sym: "Sr", a: 90,  z: 38, n: 52,  hl: "28.79 years",        mode: "beta-",
    chain: ["Sr-90", "Y-90", "Zr-90 (stable)"],
    note: "Chemically like calcium, so the body files it into bone. That is the danger." },

  { id: "tc99m", sym: "Tc", a: 99,  m: true, z: 43, n: 56, hl: "6.01 hours",  mode: "it",
    chain: ["Tc-99m", "Tc-99", "Ru-99 (stable)"],
    note: "The workhorse of medical imaging. It sheds a gamma ray and settles down." },

  { id: "i131",  sym: "I",  a: 131, z: 53, n: 78,  hl: "8.03 days",          mode: "beta-",
    chain: ["I-131", "Xe-131 (stable)"],
    note: "Treats thyroid disease, and is released by reactor accidents." },

  { id: "xe133", sym: "Xe", a: 133, z: 54, n: 79,  hl: "5.25 days",          mode: "beta-",
    chain: ["Xe-133", "Cs-133 (stable)"],
    note: "Inhaled for lung imaging, and a telltale sign of a reactor leak." },

  { id: "cs137", sym: "Cs", a: 137, z: 55, n: 82,  hl: "30.08 years",        mode: "beta-",
    chain: ["Cs-137", "Ba-137m", "Ba-137 (stable)"],
    note: "The long-lived fallout nuclide. Still measurable across Europe." },

  { id: "pb208", sym: "Pb", a: 208, z: 82, n: 126, hl: "stable",             mode: "stable",
    chain: ["Pb-208 (stable)"],
    note: "The heaviest stable nuclide, and where the thorium series stops." },

  { id: "bi209", sym: "Bi", a: 209, z: 83, n: 126, hl: "20 billion billion years", mode: "alpha",
    chain: ["Bi-209", "Tl-205 (stable)"],
    note: "Technically unstable, with a half-life a billion times the age of the universe." },

  { id: "po210", sym: "Po", a: 210, z: 84, n: 126, hl: "138.4 days",         mode: "alpha",
    chain: ["Po-210", "Pb-206 (stable)"],
    note: "Marie Curie named it for Poland. Intensely toxic if it gets inside you." },

  { id: "rn222", sym: "Rn", a: 222, z: 86, n: 136, hl: "3.82 days",          mode: "alpha",
    chain: ["Rn-222", "Po-218", "Pb-214", "Pb-206 (stable)"],
    note: "Seeps out of the ground into basements. The reason radon tests exist." },

  { id: "ra226", sym: "Ra", a: 226, z: 88, n: 138, hl: "1,600 years",        mode: "alpha",
    chain: ["Ra-226", "Rn-222", "Po-218", "Pb-206 (stable)"],
    note: "Curie's radium. Once painted onto watch dials, with terrible results." },

  { id: "th232", sym: "Th", a: 232, z: 90, n: 142, hl: "14.05 billion years", mode: "alpha",
    chain: ["Th-232", "Ra-228", "Th-228", "Pb-208 (stable)"],
    note: "Older than the Earth and more common than uranium. Starts its own series." },

  { id: "u235",  sym: "U",  a: 235, z: 92, n: 143, hl: "704 million years",  mode: "alpha",
    chain: ["U-235", "Th-231", "Ra-223", "Pb-207 (stable)"],
    note: "The fissile one. Only 0.7 percent of natural uranium, which is why enrichment exists." },

  { id: "u238",  sym: "U",  a: 238, z: 92, n: 146, hl: "4.47 billion years", mode: "alpha",
    chain: ["U-238", "Th-234", "U-234", "Ra-226", "Pb-206 (stable)"],
    note: "Most of the uranium in the crust, and older than the crust itself." },

  { id: "np237", sym: "Np", a: 237, z: 93, n: 144, hl: "2.14 million years", mode: "alpha",
    chain: ["Np-237", "Pa-233", "U-233", "Bi-209 (near stable)"],
    note: "The fourth decay series, almost entirely gone from nature." },

  { id: "pu238", sym: "Pu", a: 238, z: 94, n: 144, hl: "87.7 years",         mode: "alpha",
    chain: ["Pu-238", "U-234", "Th-230", "Pb-206 (stable)"],
    note: "Warm to the touch from its own decay. It powers Voyager and Curiosity." },

  { id: "pu239", sym: "Pu", a: 239, z: 94, n: 145, hl: "24,110 years",       mode: "alpha",
    chain: ["Pu-239", "U-235", "Th-231", "Pb-207 (stable)"],
    note: "Bred from U-238 in a reactor. The other fissile material." },

  { id: "am241", sym: "Am", a: 241, z: 95, n: 146, hl: "432.6 years",        mode: "alpha",
    chain: ["Am-241", "Np-237", "Pa-233", "Bi-209 (near stable)"],
    note: "There is a speck of it in most household smoke detectors." },

  { id: "cf252", sym: "Cf", a: 252, z: 98, n: 154, hl: "2.65 years",         mode: "alpha",
    chain: ["Cf-252", "Cm-248", "Pu-244", "Pb-206 (stable)"],
    note: "A rare neutron source. Also splits itself in two about three percent of the time." }
];
