const axios = require("axios");
const fs = require("fs");
const path = require("path");
module.exports = {
  config: {
    name: "emojimix",
    aliases: ["mixemoji", "emix"],
    version: "2.2",
    author: "SAGOR",
    countDown: 5,
    role: 0,
    shortDescription: {
      en: "Mix two emojis"
    },
    longDescription: {
      en: "Create an emoji mix from two emojis."
    },
    category: "fun",
    guide: {
      en: "{pn} 😔🥵"
    }
  },
  onStart: async function ({ message, args }) {
    const cacheDir = path.join(__dirname, "cache");
    const filePath = path.join(
      cacheDir,
      `emojimix_${Date.now()}.jpg`
    );
    try {
      const input = args.join("").trim();
      if (!input) {
        return message.reply(
          "Please provide two emojis.\n\nExample:\n,emojimix 😔🥵"
        );
      }
      const segmenter = new Intl.Segmenter("en", {
        granularity: "grapheme"
      });
      const emojis = [...segmenter.segment(input)]
        .map(x => x.segment)
        .filter(x => x.trim());
      if (emojis.length < 2) {
        return message.reply(
          "Please provide two emojis."
        );
      }
      const emoji1 = emojis[0];
      const emoji2 = emojis[1];
      const apiUrl =
        "https://sagor-apis-nx.vercel.app/sagor/emojimix" +
        `?emoji1=${encodeURIComponent(emoji1)}` +
        `&emoji2=${encodeURIComponent(emoji2)}` +
        "&apikey=sagor";
      const response = await axios.get(apiUrl, {
        timeout: 15000
      });
      const imageUrl = response.data?.data?.[0]?.image;
      if (!imageUrl) {
        return message.reply("No emoji mix was found.");
      }
      fs.mkdirSync(cacheDir, { recursive: true });
      const image = await axios.get(imageUrl, {
        responseType: "arraybuffer",
        timeout: 15000
      });
      fs.writeFileSync(filePath, image.data);
      const stream = fs.createReadStream(filePath);
      await message.reply({
        body: `${emoji1} + ${emoji2}`,
        attachment: stream
      });
      setTimeout(() => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }, 10000);
    } catch (error) {
      console.error("EmojiMix:", error);
      return message.reply("Failed to create emoji mix.");
    }
  }
};
