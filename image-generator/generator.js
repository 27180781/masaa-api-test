const sharp = require('sharp');
const { COLORS, FONTS, LAYOUT } = require('./config.js');

function createTextSvg(text, font, color) {
    const [fontFamily, weight, size] = font.split(' ');
    // שימוש ב-dy כדי למנוע חיתוך של האותיות התחתונות
    return Buffer.from(`
    <svg width="1800" height="150">
      <style>
        .title { fill: ${color}; font-size: ${size}px; font-family: '${fontFamily}'; font-weight: ${weight}; }
      </style>
      <text x="50%" y="50%" dy=".35em" dominant-baseline="middle" text-anchor="middle" class="title">${text}</text>
    </svg>`);
}

async function createGameSummaryImage(profile) {
    const { width, height, backgroundImagePath, barWidth, barMargin, chartHeight } = LAYOUT.summaryChart;

    // יצירת שכבות SVG עבור הכותרות
    const mainTitleSvg = createTextSvg(
        'סיכום תוצאות למשחק',
        FONTS.mainTitle,
        COLORS.title
    );
    const subtitleSvg = createTextSvg(
        'פילוח היסודות לכלל המשתתפים',
        FONTS.subtitle,
        COLORS.title
    );

    const compositeLayers = [
        { input: mainTitleSvg, top: 20, left: 60 },
        { input: subtitleSvg, top: 100, left: 60 }
    ];
    
    const elements = Object.keys(profile);
    const startX = (width - (elements.length * (barWidth + barMargin) - barMargin)) / 2;

    for (const [index, element] of elements.entries()) {
        const barHeight = (profile[element] / 100) * chartHeight;
        const x = startX + index * (barWidth + barMargin);
        const y = height - 100 - barHeight;
        const hebrewElement = { fire: 'אש', water: 'מים', air: 'אוויר', earth: 'אדמה' }[element] || element;

        const barBuffer = await sharp({
            create: {
                width: barWidth,
                height: Math.round(barHeight),
                channels: 4,
                background: COLORS.elements[element] || COLORS.elements.default
            }
        }).png().toBuffer();

        compositeLayers.push({ input: barBuffer, top: Math.round(y), left: Math.round(x) });
        
        compositeLayers.push({
            input: createTextSvg(`${profile[element].toFixed(1)}%`, FONTS.percentage, COLORS.text),
            top: Math.round(y - 70),
            left: Math.round(x - ((1800 - barWidth) / 2)) // מרכוז הטקסט מעל העמודה
        });
        
        compositeLayers.push({
            input: createTextSvg(hebrewElement, FONTS.label, COLORS.text),
            top: Math.round(height - 130),
            left: Math.round(x - ((1800 - barWidth) / 2)) // מרכוז הטקסט מתחת לעמודה
        });
    }

    const finalImageBuffer = await sharp(backgroundImagePath)
        .composite(compositeLayers)
        .toBuffer();

    return finalImageBuffer;
}
async function createLicenseStatusImage(status) {
    const { width, height, backgroundImagePath } = LAYOUT.licenseStatus;

    let compositeLayers = [];

    if (status === 'valid') {
        const textSvg = createTextSvg(
            'רישיון המשחק בתוקף, ניתן להתחיל לשחק',
            FONTS.statusText,
            COLORS.statusOk
        );
        compositeLayers.push({ input: textSvg, top: 0, left: 0 });
    } else { // status === 'expired'
        const mainTextSvg = createTextSvg(
            'פג תוקף רישיון המשחק',
            FONTS.statusText,
            COLORS.statusError
        );
        const warningTextSvg = createTextSvg(
            'נראה ששוחק כבר פעם אחת. המשך יביא לחסימת המחשב ומחיקת נתוני המשחק.',
            FONTS.warningText,
            COLORS.text // צבע לבן רגיל לאזהרה
        );
        compositeLayers.push({ input: mainTextSvg, top: 150, left: 0 });
        compositeLayers.push({ input: warningTextSvg, top: 250, left: 0 });
    }

    const finalImageBuffer = await sharp(backgroundImagePath)
        .resize(width, height) // התאמת הרקע לגודל החדש
        .composite(compositeLayers)
        .toBuffer();

    return finalImageBuffer;
}
module.exports = {
    createGameSummaryImage,
    createLicenseStatusImage // ⬅️ הוספה
};