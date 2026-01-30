import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('AuthController (e2e)', () => {
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

  describe('/auth/register (POST)', () => {
    it('should reject short passwords', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ username: 'validUser', password: '123' })
        .expect(400)
        .expect((res) => {
            expect(res.body.message).toContain('Password must be at least 6 characters long');
        });
    });

    it('should reject short usernames', () => {
        return request(app.getHttpServer())
          .post('/auth/register')
          .send({ username: 'ab', password: 'validPassword' })
          .expect(400)
          .expect((res) => {
              expect(res.body.message).toContain('Username must be at least 3 characters long');
          });
      });

    it('should reject usernames with symbols', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ username: 'user@name', password: 'validPassword' })
        .expect(400)
        .expect((res) => {
            expect(res.body.message).toContain('Username can only contain letters, numbers, and underscores');
        });
    });

    it('should reject long usernames (>32 chars)', () => {
      const longUsername = 'a'.repeat(33);
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ username: longUsername, password: 'validPassword' })
        .expect(400)
        .expect((res) => {
            expect(res.body.message).toContain('Username must be at most 32 characters long');
        });
    });
  });
});
