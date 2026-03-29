const { Inngest } = require("inngest");
const connectDB = require("../db/connectDB");
const User = require("../../database/models/User");
const { upsertStreamUser, deleteStreamUser } = require("../stream/stream");

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

    await upsertStreamUser({
        id: newUser.clerkId.toString(),
        name: newUser.name || email_addresses[0]?.email_address,
        image: newUser.profileImage,
        role: 'candidate' // Default new users to candidate
    });
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

    await deleteStreamUser(id.toString());
  }
);

module.exports = {
  inngest,
  functions: [syncUser, deleteUserFromDB],
};
