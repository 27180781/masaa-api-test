# 1. שינוי לתמונת בסיס סטנדרטית לתאימות טובה יותר
FROM node:20

# 2. שינוי פקודת ההתקנה ל-apt-get
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev

WORKDIR /app

COPY package*.json ./
# 3. התקנת תלויות ייצור בלבד
RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]