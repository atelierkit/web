import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { KubernetesObjectService } from './object.service';

describe('KubernetesObjectService', () => {
  let service: KubernetesObjectService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(KubernetesObjectService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('清单走 POST cloud/kubernetes/object/index，集群、类型、命名空间都在请求体里', () => {
    service.objects(3, 'pods', 'default').subscribe();
    const req = http.expectOne('cloud/kubernetes/object/index');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      kubernetesId: 3,
      type: 'pods',
      namespace: 'default',
    });
    req.flush([{ name: 'web-0' }]);
  });

  it('不传命名空间时提交空串（后端按「全部命名空间」处理）', () => {
    service.objects(3, 'pods').subscribe();
    const req = http.expectOne('cloud/kubernetes/object/index');
    expect(req.request.body).toEqual({
      kubernetesId: 3,
      type: 'pods',
      namespace: '',
    });
    req.flush([]);
  });

  it('详情走 POST cloud/kubernetes/object/show', () => {
    service.object(3, 'nodes', 'home-server').subscribe();
    const req = http.expectOne('cloud/kubernetes/object/show');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      kubernetesId: 3,
      type: 'nodes',
      id: 'home-server',
      namespace: '',
    });
    req.flush({ name: 'home-server' });
  });

  it('动作走 POST cloud/kubernetes/object/action，参数平铺（不透传任意 JSON）', () => {
    service.action(3, 'deployments', 'web', 'scale', { replicas: 3 }, 'default').subscribe();
    const req = http.expectOne('cloud/kubernetes/object/action');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      kubernetesId: 3,
      type: 'deployments',
      id: 'web',
      action: 'scale',
      namespace: 'default',
      replicas: 3,
      gracePeriod: undefined,
    });
    // 注：后端 PATCH 成功返回空正文，这里照实模拟
    req.flush(null);
  });

  it('不给参数时 replicas / gracePeriod 都是 undefined（由后端走默认值）', () => {
    service.action(3, 'pods', 'web-0', 'remove').subscribe();
    const req = http.expectOne('cloud/kubernetes/object/action');
    expect(req.request.body).toEqual({
      kubernetesId: 3,
      type: 'pods',
      id: 'web-0',
      action: 'remove',
      namespace: '',
      replicas: undefined,
      gracePeriod: undefined,
    });
    req.flush(null);
  });
});
