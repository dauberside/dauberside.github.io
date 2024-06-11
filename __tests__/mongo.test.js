// __tests__/mongo.test.js
import mongoose from 'mongoose';
import Message from '../models/Message';

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

afterAll(async () => {
  await mongoose.disconnect();
});

test('creates a message', async () => {
  const msg = new Message({ username: 'test', text: 'hello' });
  const savedMsg = await msg.save();
  expect(savedMsg._id).toBeDefined();
  expect(savedMsg.username).toBe('test');
  expect(savedMsg.text).toBe('hello');
});