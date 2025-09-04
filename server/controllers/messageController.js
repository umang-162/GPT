import imagekit from "../configs/imageKit.js"
import Chat from "../models/Chat.js"
import User from "../models/User.js"
import axios from "axios"
import openai from '../configs/openai.js'


//text-based AI chat Message Controller
export const textMessageController = async(req , res)=>{
    try {
      const userId = req.user._id;

      //Check credits
      if (req.user.credits < -1000) {
        return res.json({
          success: false,
          message: "You don't have enough credits to use this feature",
        });
      }

      const { chatId, prompt } = req.body;

      const chat = await Chat.findOne({ userId, _id: chatId });
      chat.messages.push({
        role: "user",
        content: prompt,
        timestamp: Date.now(),
        isImage: false,
      });

      const { choices } = await openai.chat.completions.create({
        model: "gemini-2.0-flash",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      const reply = {
        ...choices[0].message,
        timestamp: Date.now(),
        isImage: false,
      }
      res.json({ success: true, reply });

      chat.messages.push(reply);
      await chat.save();
      await User.updateOne({ _id: userId }, { $inc: { credits: -1 } });
    } catch (error) {
        res.json({success:false, message: error.message})
    }
}

//Image Generation Message Controller
export const imageMessageController = async (req, res)=>{
    try {
        const userId= req.user._id;
        //Check credits
        if(req.user.credits < -1000){
            return res.json({success: false, message:"You don't have enough credits to use this feature"})
        }
        const {prompt,chatId,isPublished}= req.body
        //Find chat
        const chat = await Chat.findOne({userId,_id:chatId})

        //Push user message
        chat.messages.push({
            role:"user",
            content:prompt,
            timestamp: Date.now(),
            isImage: false
        })

        //Encode the prompt
        const encodedPrompt = encodeURIComponent(prompt)

        //Construct Image AI generation URL
        const generatedImageUrl = `${process.env.IMAGEKIT_URL_ENDPOINT}/ik-genimg-prompt-${encodedPrompt}/gpt/${Date.now()}.png?tr=w-800,h-800`;

        //trigger generation by fetching from Imagekit
        const aiImageResponse = await axios.get(generatedImageUrl, {responseType:"arraybuffer"})

        //convert to Base64
        const base64Image = `data:image/png;base64,${Buffer.from(aiImageResponse.data,"binary").toString('base64')}`;

        //Upload to Image Media Library
        const uploadResponse = await imagekit.upload({
            file: base64Image,
            fileName:`${Date.now()}.png`,
            folder: "gpt"
        })

        const reply = {
          role: "assistant",
          content: uploadResponse.url,
          timestamp: Date.now(),
          isImage: true,
          isPublished,
        }
        res.json({ success: true, reply });
        
        chat.messages.push(reply)
        await chat.save()
        await User.updateOne({ _id: userId }, { $inc: { credits: -2 } });
    } catch (error) {
        res.json({success:false, message: error.message})
    }
}