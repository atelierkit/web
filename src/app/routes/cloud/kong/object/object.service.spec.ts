import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { KongObjectService } from './object.service';

describe('KongObjectService', () => {
  let service: KongObjectService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(KongObjectService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('清单走 POST cloud/kong/object/index，站点与类型都在请求体里', () => {
    service.objects(3, 'routes').subscribe();
    const req = http.expectOne('cloud/kong/object/index');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ kongId: 3, type: 'routes' });
    req.flush([{ id: 'a', name: '路由一' }]);
  });

  it('详情走 POST cloud/kong/object/show', () => {
    service.object(3, 'certificates', 'abc').subscribe();
    const req = http.expectOne('cloud/kong/object/show');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      kongId: 3,
      type: 'certificates',
      id: 'abc',
    });
    req.flush({ id: 'abc' });
  });

  it('创建只带对象数据，不带对象ID', () => {
    const value = { name: '服务一', url: 'http://a:80' };
    service.create(3, 'services', value).subscribe();
    const req = http.expectOne('cloud/kong/object/create');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ kongId: 3, type: 'services', value });
    req.flush({ id: 'new' });
  });

  it('更新带对象ID与数据', () => {
    const value = { enabled: false };
    service.update(3, 'services', 'abc', value).subscribe();
    const req = http.expectOne('cloud/kong/object/update');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      kongId: 3,
      type: 'services',
      id: 'abc',
      value,
    });
    req.flush({ id: 'abc' });
  });

  it('删除走 POST cloud/kong/object/destroy，只带站点、类型与ID', () => {
    service.destroy(3, 'plugins', 'abc').subscribe();
    const req = http.expectOne('cloud/kong/object/destroy');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      kongId: 3,
      type: 'plugins',
      id: 'abc',
    });
    // 注：后端删除成功返回空正文（Kong 的 204），这里照实模拟
    req.flush(null);
  });
});
