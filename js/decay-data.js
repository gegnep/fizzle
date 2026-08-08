/* AI-ASSISTED: portions of this file were written with the help of an AI assistant (Claude), per course policy. */
/* decay-data.js: a curated set of nuclides for the Nuclide Decay experiment.

   Every step of every chain carries its own published half-life, so the
   simulation can decay the daughters as well as the parent. Chains are
   shortened to their named major steps, which the page states plainly.

   id    key used by the page
   z, n  protons and neutrons, for the chart position
   mode  alpha | beta- | beta+ | it | stable, for the chart color
   chain each step as { n: name, v: value, u: unit }, last one stable
   note  one line on why this nuclide is worth knowing

   units: s, min, h, d, y, ky (thousand), My (million), Gy (billion), Ey */

var FZ_NUCLIDES = [
  { id: "h3", sym: "H", a: 3, z: 1, n: 2, mode: "beta-",
    chain: [{ n: "H-3", v: 12.32, u: "y" }, { n: "He-3", stable: true }],
    note: "Tritium. Used in self-powered exit signs and glow vials." },

  { id: "c12", sym: "C", a: 12, z: 6, n: 6, mode: "stable",
    chain: [{ n: "C-12", stable: true }],
    note: "The control. Press play and nothing happens, which is the point." },

  { id: "c14", sym: "C", a: 14, z: 6, n: 8, mode: "beta-",
    chain: [{ n: "C-14", v: 5730, u: "y" }, { n: "N-14", stable: true }],
    note: "Radiocarbon dating. Made in the atmosphere, taken up by everything alive." },

  { id: "n13", sym: "N", a: 13, z: 7, n: 6, mode: "beta+",
    chain: [{ n: "N-13", v: 9.97, u: "min" }, { n: "C-13", stable: true }],
    note: "A positron emitter, made in a cyclotron and used the same hour." },

  { id: "f18", sym: "F", a: 18, z: 9, n: 9, mode: "beta+",
    chain: [{ n: "F-18", v: 109.8, u: "min" }, { n: "O-18", stable: true }],
    note: "The tracer behind a PET scan. Short enough to leave you quickly." },

  { id: "na22", sym: "Na", a: 22, z: 11, n: 11, mode: "beta+",
    chain: [{ n: "Na-22", v: 2.60, u: "y" }, { n: "Ne-22", stable: true }],
    note: "A lab calibration source, and a reliable way to make positrons." },

  { id: "p32", sym: "P", a: 32, z: 15, n: 17, mode: "beta-",
    chain: [{ n: "P-32", v: 14.27, u: "d" }, { n: "S-32", stable: true }],
    note: "Used to label DNA in molecular biology, back when film was the detector." },

  { id: "k40", sym: "K", a: 40, z: 19, n: 21, mode: "beta-",
    chain: [{ n: "K-40", v: 1.25, u: "Gy" }, { n: "Ca-40", stable: true }],
    note: "In every banana, and in you. One decay in ten goes to argon-40 instead of the calcium shown here." },

  { id: "fe56", sym: "Fe", a: 56, z: 26, n: 30, mode: "stable",
    chain: [{ n: "Fe-56", stable: true }],
    note: "Very nearly the most tightly bound nucleus of all. Fusion stops paying here." },

  { id: "co60", sym: "Co", a: 60, z: 27, n: 33, mode: "beta-",
    chain: [{ n: "Co-60", v: 5.27, u: "y" }, { n: "Ni-60", stable: true }],
    note: "Sterilizes medical equipment and treats tumors. A serious gamma source." },

  { id: "ni63", sym: "Ni", a: 63, z: 28, n: 35, mode: "beta-",
    chain: [{ n: "Ni-63", v: 101.2, u: "y" }, { n: "Cu-63", stable: true }],
    note: "A weak beta emitter, which makes it useful in tiny long-life batteries." },

  { id: "kr85", sym: "Kr", a: 85, z: 36, n: 49, mode: "beta-",
    chain: [{ n: "Kr-85", v: 10.76, u: "y" }, { n: "Rb-85", stable: true }],
    note: "A noble gas that still decays. Released by fuel reprocessing." },

  { id: "sr90", sym: "Sr", a: 90, z: 38, n: 52, mode: "beta-",
    chain: [{ n: "Sr-90", v: 28.79, u: "y" }, { n: "Y-90", v: 64.0, u: "h" },
            { n: "Zr-90", stable: true }],
    note: "Chemically like calcium, so the body files it into bone. That is the danger." },

  { id: "tc99m", sym: "Tc", a: 99, m: true, z: 43, n: 56, mode: "it",
    chain: [{ n: "Tc-99m", v: 6.01, u: "h" }, { n: "Tc-99", v: 211.1, u: "ky" },
            { n: "Ru-99", stable: true }],
    note: "The workhorse of medical imaging. It sheds a gamma ray and settles down." },

  { id: "i131", sym: "I", a: 131, z: 53, n: 78, mode: "beta-",
    chain: [{ n: "I-131", v: 8.03, u: "d" }, { n: "Xe-131", stable: true }],
    note: "Treats thyroid disease, and is released by reactor accidents." },

  { id: "xe133", sym: "Xe", a: 133, z: 54, n: 79, mode: "beta-",
    chain: [{ n: "Xe-133", v: 5.25, u: "d" }, { n: "Cs-133", stable: true }],
    note: "Inhaled for lung imaging, and a telltale sign of a reactor leak." },

  { id: "cs137", sym: "Cs", a: 137, z: 55, n: 82, mode: "beta-",
    chain: [{ n: "Cs-137", v: 30.08, u: "y" }, { n: "Ba-137m", v: 2.55, u: "min" },
            { n: "Ba-137", stable: true }],
    note: "The long-lived fallout nuclide. Still measurable across Europe." },

  { id: "pb208", sym: "Pb", a: 208, z: 82, n: 126, mode: "stable",
    chain: [{ n: "Pb-208", stable: true }],
    note: "The heaviest stable nuclide, and where the thorium series stops." },

  { id: "bi209", sym: "Bi", a: 209, z: 83, n: 126, mode: "alpha",
    chain: [{ n: "Bi-209", v: 20.1, u: "Ey" }, { n: "Tl-205", stable: true }],
    note: "Technically unstable, with a half-life a billion times the age of the universe." },

  { id: "po210", sym: "Po", a: 210, z: 84, n: 126, mode: "alpha",
    chain: [{ n: "Po-210", v: 138.4, u: "d" }, { n: "Pb-206", stable: true }],
    note: "Marie Curie named it for Poland. Intensely toxic if it gets inside you." },

  { id: "rn222", sym: "Rn", a: 222, z: 86, n: 136, mode: "alpha",
    chain: [{ n: "Rn-222", v: 3.82, u: "d" }, { n: "Po-218", v: 3.10, u: "min" },
            { n: "Pb-214", v: 26.8, u: "min" }, { n: "Pb-210", v: 22.2, u: "y" },
            { n: "Pb-206", stable: true }],
    note: "Seeps out of the ground into basements. The reason radon tests exist." },

  { id: "ra226", sym: "Ra", a: 226, z: 88, n: 138, mode: "alpha",
    chain: [{ n: "Ra-226", v: 1600, u: "y" }, { n: "Rn-222", v: 3.82, u: "d" },
            { n: "Po-218", v: 3.10, u: "min" }, { n: "Pb-206", stable: true }],
    note: "Curie's radium. Once painted onto watch dials, with terrible results." },

  { id: "th232", sym: "Th", a: 232, z: 90, n: 142, mode: "alpha",
    chain: [{ n: "Th-232", v: 14.05, u: "Gy" }, { n: "Ra-228", v: 5.75, u: "y" },
            { n: "Th-228", v: 1.912, u: "y" }, { n: "Pb-208", stable: true }],
    note: "Older than the Earth and more common than uranium. Starts its own series." },

  { id: "u235", sym: "U", a: 235, z: 92, n: 143, mode: "alpha",
    chain: [{ n: "U-235", v: 704, u: "My" }, { n: "Th-231", v: 25.5, u: "h" },
            { n: "Pa-231", v: 32.76, u: "ky" }, { n: "Ac-227", v: 21.77, u: "y" },
            { n: "Pb-207", stable: true }],
    note: "The fissile one. Only 0.7 percent of natural uranium, which is why enrichment exists." },

  { id: "u238", sym: "U", a: 238, z: 92, n: 146, mode: "alpha",
    chain: [{ n: "U-238", v: 4.468, u: "Gy" }, { n: "Th-234", v: 24.10, u: "d" },
            { n: "U-234", v: 245.5, u: "ky" }, { n: "Th-230", v: 75.38, u: "ky" },
            { n: "Ra-226", v: 1600, u: "y" }, { n: "Pb-206", stable: true }],
    note: "Most of the uranium in the crust, and older than the crust itself." },

  { id: "np237", sym: "Np", a: 237, z: 93, n: 144, mode: "alpha",
    chain: [{ n: "Np-237", v: 2.144, u: "My" }, { n: "Pa-233", v: 26.97, u: "d" },
            { n: "U-233", v: 159.2, u: "ky" }, { n: "Th-229", v: 7.34, u: "ky" },
            { n: "Bi-209", v: 20.1, u: "Ey" }, { n: "Tl-205", stable: true }],
    note: "The fourth decay series, almost entirely gone from nature." },

  { id: "pu238", sym: "Pu", a: 238, z: 94, n: 144, mode: "alpha",
    chain: [{ n: "Pu-238", v: 87.7, u: "y" }, { n: "U-234", v: 245.5, u: "ky" },
            { n: "Th-230", v: 75.38, u: "ky" }, { n: "Pb-206", stable: true }],
    note: "Warm to the touch from its own decay. It powers Voyager and Curiosity." },

  { id: "pu239", sym: "Pu", a: 239, z: 94, n: 145, mode: "alpha",
    chain: [{ n: "Pu-239", v: 24.11, u: "ky" }, { n: "U-235", v: 704, u: "My" },
            { n: "Th-231", v: 25.5, u: "h" }, { n: "Pb-207", stable: true }],
    note: "Bred from U-238 in a reactor. The other fissile material." },

  { id: "am241", sym: "Am", a: 241, z: 95, n: 146, mode: "alpha",
    chain: [{ n: "Am-241", v: 432.6, u: "y" }, { n: "Np-237", v: 2.144, u: "My" },
            { n: "Pa-233", v: 26.97, u: "d" }, { n: "Bi-209", v: 20.1, u: "Ey" }, { n: "Tl-205", stable: true }],
    note: "There is a speck of it in most household smoke detectors." },

  { id: "cf252", sym: "Cf", a: 252, z: 98, n: 154, mode: "alpha",
    chain: [{ n: "Cf-252", v: 2.645, u: "y" }, { n: "Cm-248", v: 348, u: "ky" },
            { n: "Pu-244", v: 80.8, u: "My" }, { n: "Pb-208", stable: true }],
    note: "A rare neutron source. Also splits itself in two about three percent of the time." }
];
