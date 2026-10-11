import sharp from "sharp";

function svgScene(body: string): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="144" viewBox="0 0 256 144">${body}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export const sunsetScenes = {
  hazyLuminousSunset: () => svgScene(`
    <defs><linearGradient id="haze" x2="0" y2="1"><stop stop-color="#7d99ac"/><stop offset=".6" stop-color="#b8bdc1"/><stop offset="1" stop-color="#f0e4cc"/></linearGradient></defs>
    <rect width="256" height="95" fill="url(#haze)"/><rect y="95" width="256" height="49" fill="#4a5861"/>
  `),
  softLavenderAfterglow: () => svgScene(`
    <defs><linearGradient id="lavender" x2="0" y2="1"><stop stop-color="#53698d"/><stop offset=".55" stop-color="#969db7"/><stop offset="1" stop-color="#c4a8c0"/></linearGradient></defs>
    <rect width="256" height="97" fill="url(#lavender)"/><rect y="97" width="256" height="47" fill="#353d50"/>
  `),
  artificialStreetlight: () => svgScene(`
    <defs><radialGradient id="lamp"><stop stop-color="#fffbc2"/><stop offset=".2" stop-color="#ffbf66"/><stop offset="1" stop-color="#f1b759" stop-opacity="0"/></radialGradient></defs>
    <rect width="256" height="144" fill="#101824"/><rect y="90" width="256" height="54" fill="#292b30"/>
    <rect x="128" y="53" width="3" height="91" fill="#090c10"/><ellipse cx="129" cy="56" rx="20" ry="17" fill="url(#lamp)"/>
  `),
  paleForeground: () => svgScene(`
    <rect width="256" height="67" fill="#8eacc6"/><rect y="67" width="256" height="77" fill="#ded2b6"/>
    <path d="M0 72 L256 80 M0 92 L256 105 M0 121 L256 131" stroke="#b3a990" stroke-width="3"/>
  `),
  narrowHorizonSunset: () => svgScene(`
    <defs><linearGradient id="narrow" x2="0" y2="1"><stop stop-color="#536b91"/><stop offset=".78" stop-color="#9c9eaf"/><stop offset=".87" stop-color="#d9949f"/><stop offset="1" stop-color="#f1c28a"/></linearGradient></defs>
    <rect width="256" height="85" fill="url(#narrow)"/>
    <rect y="85" width="256" height="59" fill="#354451"/>
  `),
  pastelSunset: () => svgScene(`
    <defs><linearGradient id="pastel" x2="0" y2="1"><stop stop-color="#7993b2"/><stop offset=".65" stop-color="#aeb1c2"/><stop offset=".84" stop-color="#dfb3bc"/><stop offset="1" stop-color="#f0c7a3"/></linearGradient></defs>
    <rect width="256" height="92" fill="url(#pastel)"/>
    <rect y="92" width="256" height="52" fill="#68777f"/>
  `),
  broadGoldenCloudSunset: () => svgScene(`
    <defs><linearGradient id="gold" x2="0" y2="1"><stop stop-color="#3d587c"/><stop offset=".35" stop-color="#878b9c"/><stop offset=".6" stop-color="#ddbb85"/><stop offset="1" stop-color="#ffcf79"/></linearGradient></defs>
    <rect width="256" height="102" fill="url(#gold)"/>
    <path d="M0 64 Q70 61 128 66 T256 63 L256 70 Q188 74 128 71 T0 72Z" fill="#73717b"/>
    <rect y="102" width="256" height="42" fill="#202a36"/>
    <path d="M0 105 L34 94 L63 101 L100 88 L127 103 L178 96 L206 103 L256 97 L256 144 L0 144Z" fill="#202a36"/>
  `),
  saturatedCloudSunset: () => svgScene(`
    <defs><linearGradient id="drama" x2="0" y2="1"><stop stop-color="#572d84"/><stop offset=".4" stop-color="#d85baf"/><stop offset=".7" stop-color="#fa683d"/><stop offset="1" stop-color="#ffc765"/></linearGradient></defs>
    <rect width="256" height="104" fill="url(#drama)"/>
    <path d="M0 58 Q64 61 130 57 T256 58 L256 67 Q176 70 110 66 T0 68Z" fill="#743f64"/>
    <rect y="104" width="256" height="40" fill="#201a2b"/>
  `),
  blueSkyYellowField: () => svgScene(`
    <rect width="256" height="75" fill="#76abdc"/>
    <rect y="75" width="256" height="69" fill="#c5ab47"/>
    <path d="M0 77 L256 88 M0 100 L256 117 M0 122 L256 141" stroke="#8a7739" stroke-width="3"/>
  `),
  tinyOrangeObject: () => svgScene(`
    <rect width="256" height="92" fill="#a3bdd7"/>
    <rect y="92" width="256" height="52" fill="#50694b"/>
    <rect x="130" y="85" width="4" height="9" fill="#f98b36"/>
  `),
  highHorizonTerrain: () => svgScene(`
    <rect width="256" height="144" fill="#b5c4df"/>
    <path d="M0 29 L28 18 L55 28 L87 23 L123 30 L153 21 L189 30 L222 22 L256 29 L256 144 L0 144Z" fill="#7b8597"/>
    <rect y="31" width="256" height="113" fill="#99916d"/>
    <path d="M58 31 L61 31 L80 44 L124 144 L0 144Z M151 31 L157 31 L256 113 L256 144 L208 144Z" fill="#454f61"/>
    <path d="M0 34 L54 34 L48 43 L0 45Z" fill="#7898ac"/>
  `),
  sunsetAboveWarmRoofs: () => svgScene(`
    <defs><linearGradient id="s" x2="0" y2="1"><stop stop-color="#48607d"/><stop offset=".75" stop-color="#758092"/><stop offset="1" stop-color="#ffcc77"/></linearGradient></defs>
    <rect width="256" height="60" fill="url(#s)"/><circle cx="146" cy="56" r="4" fill="#fff2ad"/>
    <rect y="60" width="256" height="25" fill="#303b43"/>
    <rect y="85" width="256" height="59" fill="#b16b49"/>
    <path d="M0 85 L20 73 L49 85 M87 85 L120 70 L141 85 M177 85 L219 67 L256 85" fill="#c58554"/>
  `),
  selfossLike: () => svgScene(`
    <rect width="256" height="144" fill="#bbcedd"/>
    <path d="M0 66 L35 49 L61 65 L89 44 L129 62 L169 47 L202 67 L233 55 L256 69 L256 144 L0 144Z" fill="#77818b"/>
    <path d="M0 77 Q65 63 127 80 T256 75 L256 144 L0 144Z" fill="#b6a04f"/>
    <path d="M139 77 L147 77 L192 144 L83 144Z" fill="#727474"/>
    <path d="M143 90 L146 90 L154 144 L143 144Z" fill="#c1bd97"/>
  `),
  intenseHorizonSunset: () => svgScene(`
    <defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#344761"/><stop offset=".64" stop-color="#667491"/><stop offset=".87" stop-color="#bd8692"/><stop offset="1" stop-color="#f4b667"/></linearGradient>
    <radialGradient id="glow"><stop stop-color="#fffbd8"/><stop offset=".4" stop-color="#ffca77"/><stop offset="1" stop-color="#db943f" stop-opacity="0"/></radialGradient></defs>
    <rect width="256" height="100" fill="url(#sky)"/>
    <ellipse cx="165" cy="91" rx="27" ry="15" fill="url(#glow)"/>
    <circle cx="165" cy="92" r="4" fill="#fff3bb"/>
    <rect y="100" width="256" height="44" fill="#273347"/>
  `),
  subtleHorizonTwilight: () => svgScene(`
    <defs><linearGradient id="twilight" x2="0" y2="1"><stop stop-color="#45618b"/><stop offset=".65" stop-color="#72849d"/><stop offset=".86" stop-color="#ac7999"/><stop offset="1" stop-color="#d5ad76"/></linearGradient></defs>
    <rect width="256" height="99" fill="url(#twilight)"/>
    <rect y="99" width="256" height="45" fill="#253042"/>
  `),
  isolatedOrangePixels: () => svgScene(`
    <rect width="256" height="95" fill="#afb8c5"/>
    <rect y="95" width="256" height="49" fill="#383e38"/>
    <circle cx="31" cy="55" r="1" fill="#ed8147"/><circle cx="142" cy="79" r="1" fill="#ee7654"/>
  `),
  dramaticSunset: () => svgScene(`
    <rect width="256" height="60" fill="#35265f"/>
    <rect y="60" width="256" height="15" fill="#a83f86"/>
    <rect y="75" width="256" height="14" fill="#ef5b3b"/>
    <rect y="89" width="256" height="13" fill="#ffc45e"/>
    <circle cx="184" cy="83" r="11" fill="#fff0a8"/>
    <rect y="102" width="256" height="42" fill="#171321"/>
    <path d="M0 111 L35 91 L67 113 L105 94 L148 116 L192 96 L256 113 L256 144 L0 144Z" fill="#21172b"/>
  `),
  twilightAfterglow: () => svgScene(`
    <rect width="256" height="61" fill="#294f88"/>
    <rect y="61" width="256" height="20" fill="#70458f"/>
    <rect y="81" width="256" height="19" fill="#d06b9e"/>
    <rect y="100" width="256" height="44" fill="#182438"/>
    <path d="M0 111 Q45 91 92 109 T180 106 T256 112 L256 144 L0 144Z" fill="#111a2a"/>
  `),
  weakSunsetSignal: () => svgScene(`
    <rect width="256" height="80" fill="#78889b"/>
    <rect y="80" width="256" height="11" fill="#9b667d"/>
    <rect y="91" width="256" height="10" fill="#c47a55"/>
    <rect y="101" width="256" height="43" fill="#465143"/>
  `),
  ordinaryColorfulLandscape: () => svgScene(`
    <rect width="256" height="94" fill="#4b97d1"/>
    <rect y="94" width="256" height="7" fill="#b37e69"/>
    <path d="M0 95 Q55 72 112 99 T256 91 L256 122 L0 122Z" fill="#4d8a45"/>
    <rect y="115" width="256" height="29" fill="#93aa3a"/>
    <circle cx="42" cy="126" r="4" fill="#d73732"/><circle cx="201" cy="132" r="5" fill="#d73732"/>
  `),
  grayCloudyLandscape: () => svgScene(`
    <rect width="256" height="42" fill="#7d8288"/>
    <rect y="42" width="256" height="42" fill="#909398"/>
    <rect y="84" width="256" height="17" fill="#a48f89"/>
    <path d="M0 108 Q48 84 103 106 T205 103 T256 109 L256 144 L0 144Z" fill="#596159"/>
  `),
  snowyBlueScene: () => svgScene(`
    <rect width="256" height="67" fill="#789bc7"/>
    <rect y="67" width="256" height="34" fill="#bfd5e7"/>
    <path d="M0 108 L55 76 L101 106 L155 69 L222 109 L256 87 L256 144 L0 144Z" fill="#e7eef4"/>
    <path d="M0 120 L76 103 L132 121 L206 101 L256 116 L256 144 L0 144Z" fill="#c9d9e8"/>
  `),
  overcastRoad: () => svgScene(`
    <rect width="256" height="68" fill="#84898e"/>
    <rect y="68" width="256" height="33" fill="#788079"/>
    <path d="M93 101 L163 101 L225 144 L30 144Z" fill="#3f4245"/>
    <path d="M126 105 L131 105 L137 144 L119 144Z" fill="#d2b64d"/>
    <circle cx="103" cy="116" r="3" fill="#d63831"/><circle cx="151" cy="116" r="3" fill="#d63831"/>
  `),
  grayHarbor: () => svgScene(`
    <rect width="256" height="66" fill="#8a8f94"/>
    <rect y="66" width="256" height="35" fill="#9da2a4"/>
    <rect y="101" width="256" height="43" fill="#71838d"/>
    <path d="M26 101 L92 101 L83 113 L38 113Z" fill="#40484c"/>
    <rect x="57" y="83" width="4" height="21" fill="#444a4c"/>
  `),
  monochromePlaceholder: () => svgScene(`<rect width="256" height="144" fill="#888888"/>`),
  night: () => svgScene(`<rect width="256" height="144" fill="#030508"/><circle cx="190" cy="30" r="2" fill="#bfc6d0"/>`),
};
