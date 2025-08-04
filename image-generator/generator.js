const sharp = require('sharp');
const { COLORS, FONTS, LAYOUT } = require('./config.js');

// --------------------------------------------------
//               פונקציות עזר
// --------------------------------------------------

function createTextSvg(text, font, color, width, height) {
    const [fontFamily, weight, size] = font.split(' ');
    let strokeStyle = '';
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
        .title { fill: ${color}; font-size: ${size}px; font-family: '${fontFamily}'; font-weight: ${weight}; text-align: center; ${strokeStyle} }
      </style>
      <text x="50%" y="50%" dy=".35em" dominant-baseline="middle" text-anchor="middle" class="title">${text}</text>
    </svg>`);
}

function createRtlTextSvg(text, font, color, width, height) {
    const [fontFamily, weight, size] = font.split(' ');
    return Buffer.from(`
    <svg width="${width}" height="${height}">
      <style>
        .title { fill: ${color}; font-size: ${size}px; font-family: '${fontFamily}'; font-weight: ${weight}; }
      </style>
      <text x="${width - 10}" y="50%" dy=".35em" dominant-baseline="middle" text-anchor="end" class="title">${text}</text>
    </svg>`);
}

function createDistributionBarSvg(profile, width, height) {
    const segments = [];
    let accumulatedWidth = 0;
    const elements = ['fire', 'water', 'air', 'earth'];
    for (const element of elements) {
        const percent = profile[element] || 0;
        if (percent > 0) {
            const segmentWidth = (percent / 100) * width;
            segments.push(`<rect x="${accumulatedWidth}" y="0" width="${segmentWidth}" height="${height}" fill="${COLORS.elements[element]}" />`);
            accumulatedWidth += segmentWidth;
        }
    }
    return Buffer.from(`<svg width="${width}" height="${height}">${segments.join('')}</svg>`);
}

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

// --------------------------------------------------
//           פונקציות ראשיות ליצירת תמונות
// --------------------------------------------------

async function createGameSummaryImage(profile) {
    const { width, height, backgroundImagePath, barWidth, barMargin, chartHeight } = LAYOUT.summaryChart;
    const mainTitleSvg = createTextSvg('סיכום תוצאות למשחק', FONTS.mainTitle, COLORS.title, width, 150);
    const subtitleSvg = createTextSvg('פילוח היסודות לכלל המשתתפים', FONTS.subtitle, COLORS.title, width, 80);
    const compositeLayers = [{ input: mainTitleSvg, top: 20, left: 0 }, { input: subtitleSvg, top: 100, left: 0 }];
    const elements = Object.keys(profile);
    const startX = (width - (elements.length * (barWidth + barMargin) - barMargin)) / 2;
    for (const [index, element] of elements.entries()) {
        const barHeight = (profile[element] / 100) * chartHeight;
        const x = startX + index * (barWidth + barMargin);
        const y = height - 100 - barHeight;
        const hebrewElement = { fire: 'אש', water: 'מים', air: 'אוויר', earth: 'אדמה' }[element] || element;
        const barBuffer = await sharp({ create: { width: barWidth, height: Math.round(barHeight), channels: 4, background: COLORS.elements[element] || COLORS.elements.default } }).png().toBuffer();
        compositeLayers.push({ input: barBuffer, top: Math.round(y), left: Math.round(x) });
        compositeLayers.push({ input: createTextSvg(`${profile[element].toFixed(1)}%`, FONTS.percentage, COLORS.text, barWidth, 70), top: Math.round(y - 70), left: Math.round(x) });
        compositeLayers.push({ input: createTextSvg(hebrewElement, FONTS.label, COLORS.text, barWidth, 50), top: Math.round(height - 100), left: Math.round(x) });
    }
    return sharp(backgroundImagePath).resize(width, height).composite(compositeLayers).toBuffer();
}

async function createLicenseStatusImage(status) {
    const { width, height, backgroundImagePath } = LAYOUT.licenseStatus;
    let compositeLayers = [];
    if (status === 'valid') {
        const textSvg = createTextSvg('רישיון המשחק בתוקף, ניתן להתחיל לשחק', FONTS.statusText, COLORS.statusOk, width, 150);
        compositeLayers.push({ input: textSvg, top: Math.round(height / 2) - 75, left: 0 });
    } else {
        const mainTextSvg = createTextSvg('פג תוקף רישיון המשחק', FONTS.statusText, COLORS.statusError, width, 100);
        const warningTextSvg = createTextSvg('נראה ששוחק כבר פעם אחת. המשך יביא לחסימת המחשב ומחיקת נתוני המשחק.', FONTS.warningText, COLORS.text, width - 100, 100);
        compositeLayers.push({ input: mainTextSvg, top: Math.round(height / 2) - 120, left: 0 });
        compositeLayers.push({ input: warningTextSvg, top: Math.round(height / 2) - 20, left: 50 });
    }
    return sharp(backgroundImagePath).resize(width, height).composite(compositeLayers).toBuffer();
}

async function createGroupBreakdownImage(groups) {
    const config = LAYOUT.groupBreakdown;
    const { width, height, backgroundImagePath, pieRadius, padding } = config;
    if (!groups || groups.length === 0) {
        const noDataSvg = createTextSvg('לא נמצאו קבוצות להצגה - יש להמשיך למסך הבא', FONTS.noDataMessage, COLORS.title, width, height);
        return sharp(backgroundImagePath).resize(width, height).composite([{ input: noDataSvg, top: 0, left: 0 }]).toBuffer();
    }
    const compositeLayers = [];
    const chartSize = pieRadius * 2;
    const titleHeight = 80;
    const totalItemHeight = chartSize + titleHeight;
    const cols = Math.floor((width - padding * 2) / (chartSize + padding));
    const effectivePaddingX = (width - cols * chartSize) / (cols + 1);
    for (const [index, group] of groups.entries()) {
        const row = Math.floor(index / cols);
        const col = index % cols;
        const x = Math.round(effectivePaddingX + col * (chartSize + effectivePaddingX));
        const y = Math.round(padding + row * (totalItemHeight + padding));
        compositeLayers.push({ input: createTextSvg(group.group_name, FONTS.groupTitle, COLORS.title, chartSize, titleHeight), top: y, left: x });
        compositeLayers.push({ input: createPieChartSvg(group.profile, pieRadius), top: y + titleHeight, left: x });
    }
    return sharp(backgroundImagePath).resize(width, height).composite(compositeLayers).toBuffer();
}

async function createParticipantListImage(participants) {
    const config = LAYOUT.participantList;
    const { width, height, backgroundImagePath, padding, barWidth, barHeight } = config;

    if (!participants || participants.length === 0) {
        const noDataSvg = createTextSvg('לא נמצאו משתתפים להצגה', FONTS.noDataMessage, COLORS.title, width, height);
        return sharp(backgroundImagePath).resize(width, height).composite([{ input: noDataSvg }]).toBuffer();
    }

    const barLayers = [];
    const svgElements = []; // מערך אחד שיכיל גם טקסט וגם צורות

    // 1. יצירת רכיבי SVG עבור המקרא
    const hebrewElements = { fire: 'אש', water: 'מים', air: 'אוויר', earth: 'אדמה' };
    const legendItemWidth = 160;
    let legendX = width - padding;

    for (const element of ['earth', 'air', 'water', 'fire']) {
        legendX -= legendItemWidth;
        // ⬇️ תיקון טעות ההקלדה כאן (היה '35}')
        svgElements.push(`<rect x="${legendX + 115}" y="${padding - 30}" width="35" height="35" fill="${COLORS.elements[element]}" />`);
        svgElements.push(`<text x="${legendX}" y="${padding}" class="legend">${hebrewElements[element]}</text>`);
    }

    // 2. חישוב פריסה ויצירת רכיבי SVG עבור המשתתפים
    const maxCols = 4;
    const colWidth = (width - padding * 2) / maxCols;
    const nameHeight = 40;
    const itemGap = 25;
    const totalItemHeight = nameHeight + barHeight + itemGap;

    for (const [index, participant] of participants.entries()) {
        const row = Math.floor(index / maxCols);
        const col = index % maxCols;
        
        const x = width - padding - (col * colWidth) - colWidth;
        const y = 120 + (row * totalItemHeight);

        svgElements.push(`<text x="${x + colWidth - 20}" y="${y}" text-anchor="end" class="participant">${participant.name}</text>`);

        const barBuffer = await createDistributionBarSvg(participant.profile, barWidth, barHeight);
        barLayers.push({
            input: barBuffer,
            top: y + 10,
            left: x + (colWidth - barWidth) / 2
        });
    }

    // 3. הרכבת שכבת הטקסט והצורות הסופית
    const textLayerSvg = `
    <svg width="${width}" height="${height}">
      <style>
        text { font-family: "FbKanuba", sans-serif; fill: ${COLORS.text}; }
        .legend { font-size: ${FONTS.legendText.split(' ')[2]}px; font-weight: ${FONTS.legendText.split(' ')[1]}; text-anchor: start; }
        .participant { font-size: ${FONTS.participantName.split(' ')[2]}px; font-weight: ${FONTS.participantName.split(' ')[1]}; }
      </style>
      ${svgElements.join('')}
    </svg>`;

    const textLayerBuffer = Buffer.from(textLayerSvg);

    // 4. הרכבת התמונה הסופית
    const finalImageBuffer = await sharp(backgroundImagePath)
        .resize(width, height)
        .composite([
            ...barLayers,
            { input: textLayerBuffer }
        ])
        .toBuffer();

    return finalImageBuffer;
}
module.exports = {
    createGameSummaryImage,
    createLicenseStatusImage,
    createGroupBreakdownImage,
    createParticipantListImage
};