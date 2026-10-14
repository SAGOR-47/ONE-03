const axios = require("axios");
const yts = require("yt-search");
const fs = require("fs");
const path = require("path");
const os = require("os");

const API_BASE = "https://sagor-yt-downloader.vercel.app/sagor";

async function fetchDownloadUrl(videoUrl) {
	for (const bitrate of ["192", "128", "64"]) {
		try {
			const res = await axios.get(API_BASE, {
				params: {
					url: videoUrl,
					type: "audio",
					bitrate
				},
				timeout: 120000
			});

			if (
				res.data?.status === "success" &&
				res.data?.type === "audio" &&
				res.data?.download
			) {
				return res.data;
			}
		} catch (_) {}
	}

	return null;
}

async function downloadAudio(url, filePath) {
	const response = await axios({
		url,
		method: "GET",
		responseType: "stream",
		timeout: 180000,
		maxRedirects: 5,
		headers: {
			"User-Agent":
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
			"Accept": "*/*",
			"Referer": "https://www.youtube.com/"
		}
	});

	const contentType = response.headers["content-type"] || "";

	if (
		contentType.includes("text/html") ||
		!contentType.includes("audio") &&
		!contentType.includes("video") &&
		!contentType.includes("octet-stream")
	) {
		throw new Error("Invalid audio response");
	}

	await new Promise((resolve, reject) => {
		const writer = fs.createWriteStream(filePath);

		response.data.on("error", reject);
		writer.on("error", reject);
		writer.on("finish", resolve);

		response.data.pipe(writer);
	});

	const stat = fs.statSync(filePath);

	if (stat.size < 1024) {
		throw new Error("Downloaded audio file is too small");
	}
}

module.exports = {
	config: {
		name: "sing",
		aliases: ["song", "music"],
		version: "1.0.7",
		author: "SaGor",
		countDown: 5,
		role: 0,
		shortDescription: {
			en: "Search and send songs from YouTube"
		},
		longDescription: {
			en: "Search and download music from YouTube"
		},
		category: "music",
		guide: {
			en: "{pn} <song name>"
		}
	},

	onStart: async function ({ api, args, message }) {
		if (!args.length) {
			return message.reply(
				"❌ Please enter a song name.\nUsage: sing <song name>"
			);
		}

		let waitMsg = null;

		const filePath = path.join(
			os.tmpdir(),
			`sing_${Date.now()}.m4a`
		);

		const safeUnsend = async () => {
			try {
				if (waitMsg?.messageID) {
					await api.unsendMessage(waitMsg.messageID);
					waitMsg = null;
				}
			} catch (_) {}
		};

		try {
			waitMsg = await message.reply(
				"⏳ Searching for the song, please wait..."
			);

			const search = await yts(args.join(" "));
			const video = search.videos?.[0];

			if (!video) {
				await safeUnsend();
				return message.reply("❌ Song not found.");
			}

			let data = null;
			let downloaded = false;

			for (let attempt = 0; attempt < 3 && !downloaded; attempt++) {
				data = await fetchDownloadUrl(video.url);

				if (!data)
					continue;

				try {
					await downloadAudio(data.download, filePath);
					downloaded = true;
				} catch (_) {
					data = null;
					await new Promise(resolve =>
						setTimeout(resolve, 1000)
					);
				}
			}

			if (!downloaded || !data) {
				await safeUnsend();
				return message.reply(
					"❌ Unable to download the audio. Please try again."
				);
			}

			await safeUnsend();

			const title =
				data.title ||
				video.title ||
				"Unknown";

			await message.reply({
				body:
					`🎵 ${title}\n` +
					`⏱ ${data.duration || video.timestamp || "Unknown"}\n` +
					`🎧 ${data.bitrate || "128k"}`,
				attachment: fs.createReadStream(filePath)
			});
		} catch (err) {
			await safeUnsend();

			return message.reply(
				`❌ Error: ${err.message || "Something went wrong."}`
			);
		} finally {
			fs.unlink(filePath, () => {});
		}
	}
};
