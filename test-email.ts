import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { MeetingService } from './src/meeting/meeting.service';

async function test() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const meetingService = app.get(MeetingService);

    console.log('Testing Meeting Creation and Email...');
    try {
        await meetingService.create({
            title: 'Test Meeting Antigravity',
            date: '2026-02-11',
            time: '14:00',
            contact: 'Test Amani',
            email: 'jouiniameni93@gmail.com',
            type: 'Video Call',
            user: '67a78345c2f0f4a864ed7594' // A valid looking ID or any string if model allows
        });
        console.log('Test Meeting created successfully!');
    } catch (error) {
        console.error('Test Meeting failed:', error);
    }
    await app.close();
}

test();
