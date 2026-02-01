import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Auth Controller (Email Support)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }));
    await app.init();
  });

  afterAll(async () => {
      await app.close();
  });

  const uniqueSuffix = Date.now();
  const userData = {
      username: `user_${uniqueSuffix}`,
      email: `user_${uniqueSuffix}@example.com`,
      password: 'password123'
  };

  it('/auth/register (POST) should create user with email', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send(userData)
      .expect(201)
      .expect((res) => {
          expect(res.body.email).toBe(userData.email);
          expect(res.body.username).toBe(userData.username);
      });
  });

  it('/auth/login (POST) should login with USERNAME', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: userData.username, password: userData.password })
      .expect(201)
      .expect((res) => {
          expect(res.body.access_token).toBeDefined();
      });
  });

  it('/auth/login (POST) should login with EMAIL', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: userData.email, password: userData.password }) // DTO field is 'username' but accepts identifier
      .expect(201)
      .expect((res) => {
          expect(res.body.access_token).toBeDefined();
      });
  });
});
