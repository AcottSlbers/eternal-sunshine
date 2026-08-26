import sharp from "sharp";

function svgScene(body: string): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="144" viewBox="0 0 256 144">${body}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export const sunsetScenes = {
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
