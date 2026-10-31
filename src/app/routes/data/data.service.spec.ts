import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DataService } from './data.service';

describe('DataService', () => {
  let service: DataService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DataService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('快照走 GET data/sync/snapshot', () => {
    service.snapshot().subscribe();
    const req = http.expectOne('data/sync/snapshot');
    expect(req.request.method).toBe('GET');
    req.flush({ cards: [], queue: { queued: 0, running: 0 }, recent: [] });
  });

  it('发起同步走 POST data/sync/start，带 target', () => {
    service.start('BarByDate').subscribe();
    const req = http.expectOne('data/sync/start');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ target: 'BarByDate' });
    req.flush({ enqueued: 1, blocked: 0, note: '已排 1 条执行。' });
  });

  it('暂停走 POST data/sync/pause，带 target', () => {
    service.pause('AdjustFactor').subscribe();
    const req = http.expectOne('data/sync/pause');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ target: 'AdjustFactor' });
    req.flush({ paused: 1 });
  });
});
