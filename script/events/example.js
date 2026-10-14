// ============================================================
//  EVENT TEMPLATE
//  Events run automatically when something happens in a group
//  (someone joins, someone leaves, ...). No prefix needed.
//
//  How to make a new event:
//  1. Copy this file and rename it (example: welcomenoti.js)
//     - the file name MUST NOT contain the word "example"
//  2. Change "name" below
//  3. Choose the eventType (see list below)
//  4. Write your code inside run()
//  5. Restart the bot
// ============================================================

module.exports.config = {
  name: "myevent",               // <-- CHANGE THIS
  eventType: ["log:subscribe"],  // <-- CHOOSE WHEN IT RUNS:
                                 // "log:subscribe"   = someone joins the group
                                 // "log:unsubscribe" = someone leaves / gets kicked
  version: "1.0.0",
  credits: "Sagor",
  description: "Write what your event does here"
};

module.exports.run = async function ({ api, event, Users, Threads }) {
  try {
    const { threadID } = event;

    // ---- your code starts here ----

    // Example: welcome new members
    // event.logMessageData.addedParticipants = list of new members
    const newMembers = event.logMessageData.addedParticipants || [];

    for (const member of newMembers) {
      const name = await Users.getNameUser(member.userFbId);
      await api.sendMessage(
        `👋 Welcome to the group, ${name}!`,
        threadID
      );
    }

    // ---- your code ends here ----

  } catch (e) {
    console.log(e);
  }
};

// ============================================================
//  USEFUL THINGS YOU CAN USE:
// ------------------------------------------------------------
//  event.logMessageType
//      -> what happened ("log:subscribe" / "log:unsubscribe")
//
//  event.logMessageData.addedParticipants
//      -> new members (for log:subscribe)
//         each item: { userFbId: "123..." }
//
//  event.logMessageData.leftParticipantFbId
//      -> who left (for log:unsubscribe)
//
//  event.author
//      -> who did it (who added / who kicked)
//
//  await Users.getNameUser(fbId)
//      -> Facebook name of a user
//
//  api.sendMessage("hello", threadID)
//      -> send a message to the group
// ============================================================
