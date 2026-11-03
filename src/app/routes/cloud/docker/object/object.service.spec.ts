import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DockerObjectService } from './object.service';

describe('DockerObjectService', () => {
  let service: DockerObjectService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DockerObjectService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('清单走 POST cloud/docker/object/index，宿主机与类型都在请求体里', () => {
    service.objects(3, 'containers').subscribe();
    const req = http.expectOne('cloud/docker/object/index');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ dockerId: 3, type: 'containers' });
    req.flush([{ id: 'a', name: 'web' }]);
  });

  it('详情走 POST cloud/docker/object/show', () => {
    service.object(3, 'images', 'abcdef012345').subscribe();
    const req = http.expectOne('cloud/docker/object/show');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      dockerId: 3,
      type: 'images',
      id: 'abcdef012345',
    });
    req.flush({ id: 'abcdef012345' });
  });

  it('动作走 POST cloud/docker/object/action，参数平铺（不透传任意 JSON）', () => {
    service.action(3, 'containers', 'abc', 'remove', { force: true }).subscribe();
    const req = http.expectOne('cloud/docker/object/action');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      dockerId: 3,
      type: 'containers',
      id: 'abc',
      action: 'remove',
      force: true,
      timeout: undefined,
    });
    // 注：后端删除成功返回空正文（Docker 的 204），这里照实模拟
    req.flush(null);
  });

  it('不给参数时 force / timeout 都是 undefined（由后端走默认值）', () => {
    service.action(3, 'containers', 'abc', 'start').subscribe();
    const req = http.expectOne('cloud/docker/object/action');
    expect(req.request.body).toEqual({
      dockerId: 3,
      type: 'containers',
      id: 'abc',
      action: 'start',
      force: undefined,
      timeout: undefined,
    });
    req.flush(null);
  });
});
