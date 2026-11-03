import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { apiErrorMessage } from '@core';
import { SHARED_IMPORTS } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { filter } from 'rxjs';

import { CloudService } from '../../cloud.service';

/** 二级导航项 */
interface DockerNav {
  /** 子路由路径 */
  path: string;
  /** 展示名 */
  title: string;
}

/**
 * Docker 宿主机详情布局
 *
 * 注 1：宿主机名与 daemon 地址放在页头，下面用标签页在五个子页面之间切换；
 * 导航项直接由路由配置生成（`routeConfig.children`），避免路由表与导航两处维护
 * 注 2：子页面通过 `route.parent.snapshot.params['id']` 取宿主机ID，故本组件必须是它们的父路由
 */
@Component({
  selector: 'cloud-docker-detail',
  templateUrl: './detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
})
export class CloudDockerDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cloudSrv = inject(CloudService);
  private readonly msgSrv = inject(NzMessageService);

  /** 宿主机ID */
  readonly dockerId = Number(this.route.snapshot.params['id']);
  /** 宿主机名称 */
  readonly title = signal('Docker 宿主机');
  /** daemon 地址 */
  readonly subtitle = signal('');
  /** 二级导航 */
  readonly navs = signal<DockerNav[]>([]);

  /**
   * 导航结束的标记
   *
   * 注：只为了让下面的 `index` 在每次导航后重算 —— `router.url` 本身不参与变更检测
   */
  private readonly navigated = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
    ),
    { initialValue: null },
  );

  /** 当前选中的标签页下标 */
  readonly index = computed(() => {
    // 读一下导航标记，建立依赖
    this.navigated();
    // 注：取当前 URL 的最后一段，而不是 `route.firstChild` —— 直接打开深链接时，
    // 父组件首次渲染那一刻子路由还没激活，用 firstChild 会误判成第一个标签页
    const path = this.router.url.split('/').pop() ?? '';
    return Math.max(
      0,
      this.navs().findIndex((item) => item.path === path),
    );
  });

  /** 页面初始化 */
  ngOnInit(): void {
    /** 子路由表 */
    const children = this.route.routeConfig?.children ?? [];
    this.navs.set(
      children
        .filter((item) => !!item.path && item.path !== '**' && !!item.data?.['title'])
        .map((item) => ({
          path: String(item.path),
          title: String(item.data?.['title']),
        })),
    );
    this.cloudSrv.docker(this.dockerId).subscribe({
      next: (docker) => {
        this.title.set(docker.name);
        this.subtitle.set(docker.endpoint);
      },
      error: (err: unknown) =>
        this.msgSrv.error(apiErrorMessage(err, '加载宿主机信息失败，请稍后重试！')),
    });
  }

  /**
   * 切换标签页
   *
   * @param index 目标下标
   */
  go(index: number): void {
    /** 目标导航项 */
    const item = this.navs()[index];
    // 注：`nzSelectedIndex` 由 `index` 回写时也会触发本方法，落在当前页就直接返回，
    // 免得为同一个地址再发起一次导航
    if (!item || index === this.index()) {
      return;
    }
    void this.router.navigate(['/cloud/docker', this.dockerId, item.path]);
  }
}
