const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');
const cors = require("cors");
const app = express();
const server = createServer(app);
const io = new Server(server);
const Chat = require("./Models/Chat")
app.use(express.json(), cors());
const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/Real_Time_Chat', { useNewUrlParser: true, useUnifiedTopology: true }).then(result=>{
    console.log("Connected to database")
});


// io.on('connection', (socket) => {
//     console.log('Socket connected:', socket.id);


//     socket.on('receiving_messages', async (receive, callback) => {
//         const { senderId, receiverId, messages } = receive;
//         const newMessage = new Chat({
//             sender_id: senderId,
//             receiver_id: receiverId,
//             message: messages
//         });

//         try {
//             await newMessage.save();
//             console.log('Data successfully added');

//             // Emit the received message to all connected clients except the sender
//             socket.broadcast.emit('sending_messages', receive);
//             socket.broadcast.emit('get_all_chats', receive);
//         } catch (error) {
//             console.error('Failed to save data:', error);
//         }
//     });

//     socket.on('message', ({ senderId, message }) => {
//         // Handle received messages here (e.g., update UI, display the message)
//         console.log(`Received message from ${senderId}: ${message}`);
//       });

//       function sendMessage(send) {
//         const{senderId,receiverId,messages}= send
//         socket.emit('sendMessage', { senderId, receiverId, messages });
//       }
//     socket.on("sending_messages", async(send, callback) => {
                
//                 const{senderId,receiverId,messages}= send
//                 const RoomName = `room${senderId}${receiverId}`
//                 socket.join(RoomName)
                
//                 //Sending message to the room!
//                 io.to(RoomName).emit("sending_messages");

//                 const data = new Chat({                   
//                     sender_id:senderId,
//                     receiver_id:receiverId,
//                     message:messages
//                 })
//                 const save = await data.save()
//                 if(save)
//                     console.log("Data successfully added")
//                 else 
//                     console.log("Failed")
//                 // io.to(socket.id).emit("receiving_messages","Hi working!");
//                 socket.broadcast.emit('receiving_messages', send);
//                 socket.broadcast.emit('get_all_chats', send);
//     });
io.on('connection', (socket) => {

    console.log('Socket connected:', socket.id);
  
    socket.on('joinRoom', ({ senderId, receiverId }) => {
      const RoomName = `room${senderId}${receiverId}`;
      socket.join(RoomName);
      console.log(`${socket.id} joined room: ${RoomName}`);
    });
  
    socket.on('sendMessage', async ({ senderId, receiverId, messages }) => {
    const RoomName = `room${senderId}${receiverId}`;
   console.log("Sending messages!", messages)
      const newMessage = new Chat({
        sender_id: senderId,        
        receiver_id: receiverId,
        message: messages,
      });
      try {
        await newMessage.save();
        console.log('Data successfully added');
        // Emit the received message to all clients in the room except the sender
        io.to(RoomName).emit('receiveMessage', { senderId, messages });
      } catch (error) {
        console.error('Failed to save data:', error);
      }
    });

    socket.on('receiveMessage',  ({ senderId, receiverId, messages }) => {
        const RoomName = `room${senderId}${receiverId}`;
        socket.join(RoomName)
        console.log(`Received message from ${senderId}: ${messages}`);  
        io.to(RoomName).emit('sendMessage', { senderId, messages: "This is Curious!" });             
        });
    
    socket.on('get_all_chats', async (userId, callback) => {
        try {
            const sender_id= new ObjectId('6540df095ee07c514c834491')
            const receiver_id= new ObjectId('6540def25ee07c514c83448f')
   const chats = await Chat.find({
    $or: [
        {   
            $and: [
                { sender_id: sender_id },
                { receiver_id: receiver_id }
            ]
        },
        {
            $and: [
                { sender_id: receiver_id },
                { receiver_id: sender_id }
            ]
        }
    ]
    })
    socket.emit('get_all_chats', chats);
        } catch (error) {
            console.error('Failed to retrieve chat messages:', error);
            
        }
    });
});

 const User = require("./Models/User");
const { ObjectId } = require('bson');

app.post('/user',async(req,res)=>{

    const {name,email} = req.body
    const data= new User(req.body);
    const save = await data.save();
    if(save)
        res.status(200).send({status:1,message:"User Successfully added!"})
    else 
    res.status(400).send({status:0,message:"User Failed to add!"})
});


// ChatList API for the user!
app.get('/user-chat-list/:id', async (req, res) => {
    const userId = new mongoose.Types.ObjectId(req.params.id)

    if(!userId)
        res.status(400).send({status:1,message:"Please provide me userId"})
    try {
        const chatList = await Chat.aggregate([
            {
                
                $match: {
                    $or: [
                        { sender_id: userId },
                        { receiver_id: userId }
                    ]
                }
            },
            {
                $group: {
                    _id: {
                        $cond: [
                            { $eq: ['$sender_id', userId] },
                            '$receiver_id',
                            '$sender_id'
                        ]
                    },
                    latestMessage: { $last: '$message' },
                    count: { $sum: 1 } 
                }
            },
            {
                $lookup: {
                    from: 'users', 
                    localField: '_id',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            {
                $unwind: '$user'
            },
            {
                $project: {
                    _id: 1,
                    latestMessage: 1,
                    count: 1,
                    userId:1,
                    userName:"$user.name", 
                    // userEmail: 1 
                }
            }
        ]);

        res.status(200).json({ status: 1, message:`The User : ${userId} `, data: chatList });
    } catch (error) {
        console.error('Failed to retrieve chat lists:', error);
        res.status(500).json({ status: 0, message: "Failed to retrieve chat lists" });
    }
});


//Getting all the chat:
app.get('/user-chat', async(req,res)=>{

    const sender_id=req.body.sender_id
    const receiver_id=req.body.receiver_id
    if(!sender_id)
        res.send({status:1,message:"Please insert the sender_id"})
    else if (!receiver_id)
        res.send({status:1,message:"Please insert the receiver ID"})
//     const all_chat = await Chat.find();
//     const filteredChats = all_chat.filter((chat) => {
//        return (
//         (chat.sender_id.equals(sender_id) && chat.receiver_id.equals(receiver_id)) ||
//         (chat.sender_id.equals(receiver_id) && chat.receiver_id.equals(sender_id))
//     );
// });


   const chats = await Chat.find({
    $or: [
        {
            $and: [
                { sender_id: sender_id },
                { receiver_id: receiver_id }
            ]
        },
        {
            $and: [
                { sender_id: receiver_id },
                { receiver_id: sender_id }
            ]
        }
    ]
})
     res.status(200).send({status:1,data:chats})

})
server.listen(3003, () => {
  console.log('server running at http://localhost:3003');
});