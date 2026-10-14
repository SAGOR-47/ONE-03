module.exports = function (input) {
	const force = false;

	const Users = require("./models/users")(input);
	const Threads = require("./models/threads")(input);
	const Currencies = require("./models/currencies")(input);

	const ready = Promise.all([
		Users.sync({ force }),
		Threads.sync({ force }),
		Currencies.sync({ force })
	]);

	return {
		ready,
		model: {
			Users,
			Threads,
			Currencies
		},
		use: function (modelName) {
			return this.model[`${modelName}`];
		}
	}
}