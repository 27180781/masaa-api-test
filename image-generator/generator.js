const sharp = require('sharp');
const { COLORS, FONTS, LAYOUT } = require('./config.js');

// פונקציית עזר כללית ליצירת טקסט כ-SVG

function createTextSvg(text, font, color, width, height) {
    const [fontFamily, weight, size] = font.split(' ');

    // משתנה שיכיל את הגדרות המסגרת, אם צריך
    let strokeStyle = '';

    // תנאי: הוסף מסגרת רק אם הצבע אינו לבן
    if (color.toLowerCase() !== '#ffffff') {
        strokeStyle = `
         stroke: white;
         stroke-width: 8px;
         paint-order: stroke fill;
        `;
    }

    return Buffer.from(`
    <svg width="${width}" height="${height}">
      <style>
        .title {
         fill: ${color};
         font-size: ${size}px;
         font-family: '${fontFamily}';
         font-weight: ${weight};
         text-align: center;
         ${strokeStyle}
        }
      </style>
      <text x="50%" y="50%" dy=".35em" dominant-baseline="middle" text-anchor="middle" class="title">${text}</text>
    </svg>`);
}
// פונקציית עזר חדשה ליצירת גרף עוגה כ-SVG
function createPieChartSvg(profile, radius) {
    const size = radius * 2;
    const cx = radius;
    const cy = radius;
    let cumulativePercent = 0;
    const slices = [];

    const elements = Object.keys(profile);

    for (const element of elements) {
        const percent = profile[element];
        if (percent === 0) continue;

        const startX = cx + radius * Math.cos(2 * Math.PI * cumulativePercent / 100);
        const startY = cy + radius * Math.sin(2 * Math.PI * cumulativePercent / 100);
        cumulativePercent += percent;
        const endX = cx + radius * Math.cos(2 * Math.PI * cumulativePercent / 100);
        const endY = cy + radius * Math.sin(2 * Math.PI * cumulativePercent / 100);

        const largeArcFlag = percent > 50 ? 1 : 0;

        const path = `M ${cx},${cy} L ${startX},${startY} A ${radius},${radius} 0 ${largeArcFlag} 1 ${endX},${endY} Z`;
        slices.push(`<path d="${path}" fill="${COLORS.elements[element]}" />`);
    }

    return Buffer.from(`<svg width="${size}" height="${size}">${slices.join('')}</svg>`);
}


// --- פונקציות ייצוא ---

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

    const finalImageBuffer = await sharp(backgroundImagePath)
        .resize(width, height) // ⬅️ הוספת השורה החסרה
        .composite(compositeLayers)
        .toBuffer();

    return finalImageBuffer;
}

// פונקציה חדשה עבור פילוח קבוצות
async function createGroupBreakdownImage(groups) {
    const config = LAYOUT.groupBreakdown;
    const { width, height, backgroundImagePath, pieRadius, padding } = config;

    // מקרה קצה: אין קבוצות
    if (!groups || groups.length === 0) {
        const noDataSvg = createTextSvg('לא נמצאו קבוצות להצגה - יש להמשיך למסך הבא', FONTS.noDataMessage, COLORS.title, width, height);
        return sharp(backgroundImagePath)
            .resize(width, height)
            .composite([{ input: noDataSvg, top: 0, left: 0 }])
            .toBuffer();
    }

    const compositeLayers = [];
    const chartSize = pieRadius * 2;
    const titleHeight = 80;
    const totalItemHeight = chartSize + titleHeight;

    // חישוב פריסה דינמית של הרשת (Grid)
    const cols = Math.floor((width - padding * 2) / (chartSize + padding));
    const effectivePaddingX = (width - cols * chartSize) / (cols + 1);

    for (const [index, group] of groups.entries()) {
        const row = Math.floor(index / cols);
        const col = index % cols;

        const x = Math.round(effectivePaddingX + col * (chartSize + effectivePaddingX));
        const y = Math.round(padding + row * (totalItemHeight + padding));

        // הוספת כותרת הקבוצה
        compositeLayers.push({
            input: createTextSvg(group.group_name, FONTS.groupTitle, COLORS.title, chartSize, titleHeight),
            top: y,
            left: x
        });

        // הוספת גרף העוגה
        compositeLayers.push({
            input: createPieChartSvg(group.profile, pieRadius),
            top: y + titleHeight,
            left: x
        });
    }

    const finalImageBuffer = await sharp(backgroundImagePath)
        .resize(width, height)
        .composite(compositeLayers)
        .toBuffer();

    return finalImageBuffer;
}

async function createLicenseStatusImage(status) {
    const { width, height, backgroundImagePath } = LAYOUT.licenseStatus;
    let compositeLayers = [];

    if (status === 'valid') {
        // יצירת שכבת טקסט אחת בגודל מתאים ומיקום במרכז
        const textSvg = createTextSvg('רישיון המשחק בתוקף, ניתן להתחיל לשחק', FONTS.statusText, COLORS.statusOk, width, 150);
        compositeLayers.push({ input: textSvg, top: Math.round(height / 2) - 75, left: 0 });
    } else { // status === 'expired'
        // יצירת שתי שכבות טקסט נפרדות וממוקמות
        const mainTextSvg = createTextSvg('פג תוקף רישיון המשחק', FONTS.statusText, COLORS.statusError, width, 100);
        const warningTextSvg = createTextSvg('נראה ששוחק כבר פעם אחת. המשך יביא לחסימת המחשב ומחיקת נתוני המשחק.', FONTS.warningText, COLORS.text, width - 100, 100);

        compositeLayers.push({ input: mainTextSvg, top: Math.round(height / 2) - 120, left: 0 });
        compositeLayers.push({ input: warningTextSvg, top: Math.round(height / 2) - 20, left: 50 });
    }

    const finalImageBuffer = await sharp(backgroundImagePath)
        .resize(width, height)
        .composite(compositeLayers)
        .toBuffer();

    return finalImageBuffer;
}


module.exports = {
    createGameSummaryImage,
    createLicenseStatusImage,
    createGroupBreakdownImage // ⬅️ הוספת הפונקציה החדשה
};