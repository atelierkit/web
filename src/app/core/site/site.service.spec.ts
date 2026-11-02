import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ALLOW_ANONYMOUS } from '@delon/auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SiteInfo } from './site.format';
import { SiteService } from './site.service';

/** 订阅结果容器 */
interface InfoBox {
  /** 最近一次推送的站点信息 */
  current: SiteInfo | null;
}

describe('SiteService', () => {
  let service: SiteService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SiteService);
    http = TestBed.inject(HttpTestingController);
    // 失败分支会 warn，测试里静音避免刷屏
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  /**
   * 订阅站点信息并把推送结果收进容器
   *
   * @param source 待订阅的数据源
   * @returns 结果容器
   */
  function collect(source = service.info()): InfoBox {
    const box: InfoBox = { current: null };
    source.subscribe((value) => (box.current = value));
    return box;
  }

  it('并发读取应用配置与备案信息，且走匿名上下文', () => {
    collect();
    /** 应用配置请求 */
    const appReq = http.expectOne('passport/app');
    /** 备案信息请求 */
    const icpReq = http.expectOne('passport/icp');
    // 注：登录页与创建管理员页此时还没有令牌，若不带匿名上下文会被 401 踢回登录页
    expect(appReq.request.context.get(ALLOW_ANONYMOUS)).toBe(true);
    expect(icpReq.request.context.get(ALLOW_ANONYMOUS)).toBe(true);
    appReq.flush({ name: '星图', description: '量化平台' });
    icpReq.flush({ owner: '张三', icp: '京ICP备2024000000号' });
  });

  it('同一会话内只请求一次，页头与页脚共用同一份数据', () => {
    /** 首次订阅的结果 */
    const first = collect();
    http.expectOne('passport/app').flush({ name: '星图' });
    http.expectOne('passport/icp').flush({ icp: '京ICP备2024000000号' });
    expect(first.current).toEqual({ app: { name: '星图' }, icp: { icp: '京ICP备2024000000号' } });

    /** 第二次订阅的结果，注：缓存命中时同步重放 */
    const second = collect();
    expect(second.current).toEqual(first.current);
    http.expectNone('passport/app');
    http.expectNone('passport/icp');
  });

  it('单个接口失败时只置空该项，不打断整体', () => {
    /** 订阅结果 */
    const box = collect();
    http.expectOne('passport/app').flush({ name: '星图' });
    http.expectOne('passport/icp').flush('服务器异常', {
      status: 500,
      statusText: 'Server Error',
    });
    // 备案接口挂了仍要能显示应用名称，页脚自行隐藏备案行
    expect(box.current).toEqual({ app: { name: '星图' }, icp: {} });
  });

  it('后端返回空体时按未配置处理', () => {
    /** 订阅结果 */
    const box = collect();
    http.expectOne('passport/app').flush(null);
    http.expectOne('passport/icp').flush(null);
    expect(box.current).toEqual({ app: {}, icp: {} });
  });

  it('强制刷新时重新请求，不使用缓存', () => {
    collect();
    http.expectOne('passport/app').flush({ name: '旧名称' });
    http.expectOne('passport/icp').flush({});

    /** 强制刷新后的结果 */
    const box = collect(service.info(true));
    http.expectOne('passport/app').flush({ name: '新名称' });
    http.expectOne('passport/icp').flush({});
    expect(box.current?.app.name).toBe('新名称');
  });
});
