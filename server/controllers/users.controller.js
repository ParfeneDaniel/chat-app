const User = require("../models/user.model");
const Conversation = require("../models/conversation.model");
const client = require("../config/connectToRedis");
const crypto = require("crypto");

const getUsers = async (req, res) => {
  try {
    const userId = req.user.id;
    const users = await User.find({ _id: { $ne: userId } }).select([
      "_id",
      "username",
    ]);
    res.status(201).json({ message: "All users", users });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server Error", errors: error.message });
  }
};

const getReceivedRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    res.status(201).json({
      message: "Receive Requests were send",
      receivedRequests: user.receivedRequests,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server Error", errors: error.message });
  }
};

const getSentRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    res.status(201).json({
      message: "Send Requests were send",
      sentRequests: user.sentRequests,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server Error", errors: error.message });
  }
};

const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    const unreadMessages = await client.hGetAll(userId.toString());
    res.status(201).json({
      message: "Your list of conversations was send",
      conversations: user.conversations,
      unreadMessages,
    });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "Internal Server Error", errors: error.message });
  }
};

const sendRequest = async (req, res) => {
  try {
    const { receiverId } = req.body;
    const userId = req.user.id;
    const senderUser = await User.findById(userId);
    const receiverUser = await User.findById(receiverId);
    const existRequest =
      receiverUser.receivedRequests.find((req) => req.id == userId) ||
      receiverUser.sentRequests.find((req) => req.id == userId);
    if (existRequest) {
      return res
        .status(403)
        .json({ message: "There is a request between you" });
    }
    const isAlreadyFriends = receiverUser.conversations.find(
      (friend) => friend.id == userId
    );
    if (isAlreadyFriends) {
      return res
        .status(403)
        .json({ message: "You already are friend with this person" });
    }
    receiverUser.receivedRequests.push({
      id: userId,
      username: senderUser.username,
    });
    senderUser.sentRequests.push({
      id: receiverId,
      username: receiverUser.username,
    });
    await Promise.all([receiverUser.save(), senderUser.save()]);
    res.status(201).json({ message: "Request was send" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server Error", errors: error.message });
  }
};

const acceptRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const { senderId } = req.body;
    const user = await User.findById(userId);
    const senderUser = await User.findById(senderId);
    const ID = crypto.randomBytes(32).toString("hex");
    await Promise.all([
      User.updateMany(
        { _id: userId },
        {
          $pull: { receivedRequests: { id: senderId } },
          $addToSet: {
            conversations: { id: senderId, username: senderUser.username, ID },
          },
        }
      ),
      User.updateMany(
        { _id: senderId },
        {
          $pull: { sentRequests: { id: userId } },
          $addToSet: {
            conversations: { id: userId, username: user.username, ID },
          },
        }
      ),
      new Conversation({
        ID,
        parties: [
          { id: senderId, index: 0 },
          { id: userId, index: 1 },
        ],
      }).save(),
      client.hSet(userId.toString(), ID.toString(), 0),
      client.hSet(senderId.toString(), ID.toString(), 0),
    ]);
    res.status(201).json({ message: "You accept as friend this user" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server Error", errors: error.message });
  }
};

module.exports = {
  getUsers,
  getReceivedRequests,
  getSentRequests,
  getConversations,
  sendRequest,
  acceptRequest,
};