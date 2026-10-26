import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('registers a user and returns a created board by ID', async () => {
    const email = `e2e-${Date.now()}@taskflow.local`;
    const registration = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'TestPassword123!', name: 'E2E User' })
      .expect(201);

    const token = registration.body.token as string;
    const headers = { Authorization: `Bearer ${token}` };

    await request(app.getHttpServer())
      .get('/auth/profile')
      .set(headers)
      .expect(200);

    const board = await request(app.getHttpServer())
      .post('/boards')
      .set(headers)
      .send({ title: 'E2E board' })
      .expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/boards/${board.body.id}`)
      .set(headers)
      .expect(200);

    expect(detail.body.id).toBe(board.body.id);
    expect(detail.body.title).toBe('E2E board');

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'TestPassword123!' })
      .expect(201);
    expect(login.body.token).toBeDefined();

    const viewerRegistration = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `e2e-viewer-${Date.now()}@taskflow.local`,
        password: 'TestPassword123!',
        name: 'E2E Viewer',
      })
      .expect(201);
    const viewerHeaders = {
      Authorization: `Bearer ${viewerRegistration.body.token}`,
    };

    await request(app.getHttpServer())
      .post(`/boards/${board.body.id}/members`)
      .set(headers)
      .send({ userId: viewerRegistration.body.user.id, role: 'VIEWER' })
      .expect(201);

    await request(app.getHttpServer())
      .put(`/boards/${board.body.id}`)
      .set(viewerHeaders)
      .send({ title: 'Viewer cannot edit' })
      .expect(403);

    const firstColumn = await request(app.getHttpServer())
      .post(`/columns/board/${board.body.id}`)
      .set(headers)
      .send({ title: 'Todo' })
      .expect(201);
    const secondColumn = await request(app.getHttpServer())
      .post(`/columns/board/${board.body.id}`)
      .set(headers)
      .send({ title: 'Done' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/columns/board/${board.body.id}`)
      .set(viewerHeaders)
      .send({ title: 'Viewer cannot create columns' })
      .expect(403);

    const label = await request(app.getHttpServer())
      .post(`/labels/board/${board.body.id}`)
      .set(headers)
      .send({ name: 'Urgent', color: '#FF5733' })
      .expect(201);

    const card = await request(app.getHttpServer())
      .post(`/cards/column/${firstColumn.body.id}`)
      .set(headers)
      .send({ title: 'E2E card', labelIds: [label.body.id] })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/cards/${card.body.id}`)
      .set(headers)
      .expect(200);

    const comment = await request(app.getHttpServer())
      .post(`/comments/card/${card.body.id}`)
      .set(headers)
      .send({ content: 'E2E comment' })
      .expect(201);

    await request(app.getHttpServer())
      .put(`/comments/${comment.body.id}`)
      .set(headers)
      .send({ content: 'Updated E2E comment' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/cards/${card.body.id}/move`)
      .set(headers)
      .send({ columnId: secondColumn.body.id, order: 0 })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/boards/${board.body.id}`)
      .set(headers)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/boards/${board.body.id}`)
      .set(headers)
      .expect(404);
  });

  afterEach(async () => {
    await app.close();
  });
});
