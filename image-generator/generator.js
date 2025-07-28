const sharp = require('sharp');
const { COLORS, FONTS, LAYOUT } = require('./config.js');

// פונקציית עזר משופרת שמקבלת מידות
function createTextSvg(text, font, color, width, height) {
 const [fontFamily, weight, size] = font.split(' ');
 return Buffer.from(`
 <svg width="${width}" height="${height}">
  <style>
   .title {
    fill: ${color};
    font-size: ${size}px;
    font-family: '${fontFamily}';
    font-weight: ${weight};
    text-align: center;
    stroke: white;           /* הוספת צבע המסגרת */
    stroke-width: 8px;       /* הוספת עובי המסגרת */
    paint-order: stroke fill; /* מבטיח שהמסגרת מאחורי המילוי */
   }
  </style>
  <text x="50%" y="50%" dy=".35em" dominant-baseline="middle" text-anchor="middle" class="title">${text}</text>
 </svg>
 `);
}

async function createGameSummaryImage(profile) {
    const { width, height, backgroundImagePath, barWidth, barMargin, chartHeight } = LAYOUT.summaryChart;

    const mainTitleSvg = createTextSvg('סיכום תוצאות למשחק', FONTS.mainTitle, COLORS.title, width, 150);
    const subtitleSvg = createTextSvg('פילוח היסודות לכלל המשתתפים', FONTS.subtitle, COLORS.title, width, 80);

    const compositeLayers = [
        { input: mainTitleSvg, top: 20, left: 0 },
        { input: subtitleSvg, top: 100, left: 0 }
    ];
    
    const elements = Object.keys(profile);
    const startX = (width - (elements.length * (barWidth + barMargin) - barMargin)) / 2;

    for (const [index, element] of elements.entries()) {
        const barHeight = (profile[element] / 100) * chartHeight;
        const x = startX + index * (barWidth + barMargin);
        const y = height - 100 - barHeight;
        const hebrewElement = { fire: 'אש', water: 'מים', air: 'אוויר', earth: 'אדמה' }[element] || element;

        const barBuffer = await sharp({ create: { width: barWidth, height: Math.round(barHeight), channels: 4, background: COLORS.elements[element] || COLORS.elements.default } }).png().toBuffer();

        compositeLayers.push({ input: barBuffer, top: Math.round(y), left: Math.round(x) });
        
        compositeLayers.push({
            input: createTextSvg(`${profile[element].toFixed(1)}%`, FONTS.percentage, COLORS.text, barWidth, 70),
            top: Math.round(y - 70),
            left: Math.round(x)
        });
        
        compositeLayers.push({
            input: createTextSvg(hebrewElement, FONTS.label, COLORS.text, barWidth, 50),
            top: Math.round(height - 100),
            left: Math.round(x)
        });
    }

    const finalImageBuffer = await sharp(backgroundImagePath).composite(compositeLayers).toBuffer();
    return finalImageBuffer;
}

async function createLicenseStatusImage(status) {
    const { width, height, backgroundImagePath } = LAYOUT.licenseStatus;
    let compositeLayers = [];

    if (status === 'valid') {
        const textSvg = createTextSvg('רישיון המשחק בתוקף, ניתן להתחיל לשחק', FONTS.statusText, COLORS.statusOk, width, height);
        compositeLayers.push({ input: textSvg, top: 0, left: 0 });
    } else { // status === 'expired'
        const mainTextSvg = createTextSvg('פג תוקף רישיון המשחק', FONTS.statusText, COLORS.statusError, width, 100);
        const warningTextSvg = createTextSvg('נראה ששוחק כבר פעם אחת. המשך יביא לחסימת המחשב ומחיקת נתוני המשחק.', FONTS.warningText, COLORS.text, width, 100);
        
        compositeLayers.push({ input: mainTextSvg, top: Math.round(height / 2) - 100, left: 0 });
        compositeLayers.push({ input: warningTextSvg, top: Math.round(height / 2), left: 0 });
    }

    const finalImageBuffer = await sharp(backgroundImagePath)
        .resize(width, height)
        .composite(compositeLayers)
        .toBuffer();

    return finalImageBuffer;
}


module.exports = {
    createGameSummaryImage,
    createLicenseStatusImage
};