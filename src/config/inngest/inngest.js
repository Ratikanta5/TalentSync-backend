const { Inngest } = require("inngest");
const connectDB = require("../db/connectDB");
const User = require("../../models/User");

// Create Inngest client
const inngest = new Inngest({
  id: "TalentSync",
});

// Sync user on creation
const syncUser = inngest.createFunction(
  { id: "sync-user" },
  { event: "clerk/user.created" },
  async ({ event }) => {
    await connectDB();

    const {
      id,
      email_addresses,
      first_name,
      last_name,
      image_url,
    } = event.data;

    const newUser = {
      clerkId: id,
      email: email_addresses[0]?.email_address,
      name: `${first_name || ""} ${last_name || ""}`.trim(),
      profileImage: image_url,
    };

    await User.create(newUser);
  }
);

// Delete user on deletion
const deleteUserFromDB = inngest.createFunction(
  { id: "delete-user-from-db" },
  { event: "clerk/user.deleted" },
  async ({ event }) => {
    await connectDB();

    const { id } = event.data;
    await User.deleteOne({ clerkId: id });
  }
);

module.exports = {
  inngest,
  functions: [syncUser, deleteUserFromDB],
};
