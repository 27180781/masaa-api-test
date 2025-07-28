const sharp = require('sharp');
const { COLORS, FONTS, LAYOUT } = require('./config.js');

// פונקציית עזר כללית ליצירת טקסט כ-SVG
function createTextSvg(text, font, color, width, height) {
    const [fontFamily, weight, size] = font.split(' ');
    return Buffer.from(`
    <svg width="${width}" height="${height}">
      <style>
        .title { fill: ${color}; font-size: ${size}px; font-family: '${fontFamily}'; font-weight: ${weight}; text-align: center; }
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

async function createGameSummaryImage(profile) { /* ... קוד קיים ללא שינוי ... */ }

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

async function createLicenseStatusImage(status) { /* ... קוד קיים ללא שינוי ... */ }


module.exports = {
    createGameSummaryImage,
    createLicenseStatusImage,
    createGroupBreakdownImage // ⬅️ הוספת הפונקציה החדשה
};