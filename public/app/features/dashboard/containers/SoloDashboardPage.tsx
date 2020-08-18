// Libraries
import React, { Component } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';

// Components
import { DashboardPanel } from '../dashgrid/DashboardPanel';
// Redux
import { initDashboard } from '../state/initDashboard';

// Types
import { StoreState, DashboardRouteInfo } from 'app/types';
import { PanelModel, DashboardModel } from 'app/features/dashboard/state';
import { DashboardRow } from '../components/DashboardRow';
import { AddPanelWidget } from '../components/AddPanelWidget';
import classNames from 'classnames';
import ReactGridLayout, { ItemCallback } from 'react-grid-layout';
import { GRID_CELL_HEIGHT, GRID_CELL_VMARGIN, GRID_COLUMN_COUNT } from '../../../core/constants';
// @ts-ignore
import sizeMe from 'react-sizeme';
import { getConfig } from '../../../core/config';
import { SubMenu } from '../components/SubMenu/SubMenu';

let lastGridWidth = 1200;
let ignoreNextWidthChange = false;

interface Props {
  urlPanelId: string;
  urlUid?: string;
  urlSlug?: string;
  urlType?: string;
  $scope: any;
  $injector: any;
  routeInfo: DashboardRouteInfo;
  initDashboard: typeof initDashboard;
  dashboard: DashboardModel | null;
  viewPanel: PanelModel | null;
}

interface State {
  panel: PanelModel | null;
  notFound: boolean;
  editPanel: PanelModel | null;
}

interface GridWrapperProps {
  size: { width: number };
  layout: ReactGridLayout.Layout[];
  onLayoutChange: (layout: ReactGridLayout.Layout[]) => void;
  children: JSX.Element | JSX.Element[];
  onDragStop: ItemCallback;
  onResize: ItemCallback;
  onResizeStop: ItemCallback;
  onWidthChange: () => void;
  className: string;
  isResizable?: boolean;
  isDraggable?: boolean;
  viewPanel: PanelModel | null;
}

function GridWrapper({
  size,
  layout,
  onLayoutChange,
  children,
  onDragStop,
  onResize,
  onResizeStop,
  onWidthChange,
  className,
  isResizable,
  isDraggable,
  viewPanel,
}: GridWrapperProps) {
  const width = size.width > 0 ? size.width : lastGridWidth;

  // logic to ignore width changes (optimization)
  if (width !== lastGridWidth) {
    if (ignoreNextWidthChange) {
      ignoreNextWidthChange = false;
    } else if (!viewPanel && Math.abs(width - lastGridWidth) > 8) {
      onWidthChange();
      lastGridWidth = width;
    }
  }

  /*
    Disable draggable if mobile device, solving an issue with unintentionally
     moving panels. https://github.com/grafana/grafana/issues/18497
  */
  const draggable = width <= 420 ? false : isDraggable;

  return (
    <ReactGridLayout
      width={lastGridWidth}
      className={className}
      isDraggable={draggable}
      isResizable={isResizable}
      containerPadding={[0, 0]}
      useCSSTransforms={false}
      margin={[GRID_CELL_VMARGIN, GRID_CELL_VMARGIN]}
      cols={GRID_COLUMN_COUNT}
      rowHeight={GRID_CELL_HEIGHT}
      draggableHandle=".grid-drag-handle"
      layout={layout}
      onResize={onResize}
      onResizeStop={onResizeStop}
      onDragStop={onDragStop}
      onLayoutChange={onLayoutChange}
    >
      {children}
    </ReactGridLayout>
  );
}

const SizedReactLayoutGrid = sizeMe({ monitorWidth: true })(GridWrapper);

export class SoloPanelPage extends Component<Props, State> {
  panelMap: { [id: string]: PanelModel };

  state: State = {
    panel: null,
    notFound: false,
    editPanel: null,
  };

  componentDidMount() {
    const { $injector, $scope, urlUid, urlType, urlSlug, routeInfo } = this.props;

    this.props.initDashboard({
      $injector: $injector,
      $scope: $scope,
      urlSlug: urlSlug,
      urlUid: urlUid,
      urlType: urlType,
      routeInfo: routeInfo,
      fixUrl: false,
    });
  }

  componentDidUpdate(prevProps: Props) {
    const { urlPanelId, dashboard } = this.props;

    if (!dashboard) {
      return;
    }

    // we just got the dashboard!
    if (!prevProps.dashboard) {
      const panelId = parseInt(urlPanelId, 10);

      // need to expand parent row if this panel is inside a row
      dashboard.expandParentRowFor(panelId);

      const panel = dashboard.getPanelById(panelId);

      if (!panel) {
        this.setState({ notFound: true });
        return;
      }

      this.setState({ panel });
    }
  }

  buildLayout() {
    const layout = [];
    this.panelMap = {};

    for (const panel of this.props.dashboard.panels) {
      const stringId = panel.id.toString();
      this.panelMap[stringId] = panel;

      if (!panel.gridPos) {
        console.log('panel without gridpos');
        continue;
      }

      const panelPos: any = {
        i: stringId,
        x: panel.gridPos.x,
        y: panel.gridPos.y,
        w: panel.gridPos.w,
        h: panel.gridPos.h,
      };

      if (panel.type === 'row') {
        panelPos.w = GRID_COLUMN_COUNT;
        panelPos.h = 1;
        panelPos.isResizable = false;
        panelPos.isDraggable = panel.collapsed;
      }

      layout.push(panelPos);
    }

    return layout;
  }

  onResize: ItemCallback = (layout, oldItem, newItem) => {
    this.panelMap[newItem.i!].updateGridPos(newItem);
  };

  onResizeStop: ItemCallback = (layout, oldItem, newItem) => {
    this.updateGridPos(newItem, layout);
    this.panelMap[newItem.i!].resizeDone();
  };

  onDragStop: ItemCallback = (layout, oldItem, newItem) => {
    this.updateGridPos(newItem, layout);
  };

  updateGridPos = (item: ReactGridLayout.Layout, layout: ReactGridLayout.Layout[]) => {
    this.panelMap[item.i!].updateGridPos(item);

    // react-grid-layout has a bug (#670), and onLayoutChange() is only called when the component is mounted.
    // So it's required to call it explicitly when panel resized or moved to save layout changes.
    this.onLayoutChange(layout);
  };

  onWidthChange = () => {
    for (const panel of this.props.dashboard.panels) {
      panel.resizeDone();
    }
  };

  onLayoutChange = (newLayout: ReactGridLayout.Layout[]) => {
    for (const newPos of newLayout) {
      this.panelMap[newPos.i!].updateGridPos(newPos);
    }

    this.props.dashboard.sortPanelsByGridPos();

    // Call render() after any changes.  This is called when the layour loads
    this.forceUpdate();
  };

  renderPanels() {
    const panelElements = [];

    for (const panel of this.props.dashboard.panels) {
      const panelClasses = classNames({
        'panels-solo': true,
        'react-grid-item--fullscreen': panel.isViewing,
      });
      const id = panel.id.toString();
      panelElements.push(
        <div key={id} className={panelClasses}>
          {this.renderPanel(panel)}
        </div>
      );
    }

    return panelElements;
  }

  renderPanel(panel: PanelModel) {
    if (panel.type === 'row') {
      return <DashboardRow panel={panel} dashboard={this.props.dashboard} />;
    }

    if (panel.type === 'add-panel') {
      return <AddPanelWidget panel={panel} dashboard={this.props.dashboard} />;
    }

    return (
      <DashboardPanel
        dashboard={this.props.dashboard}
        panel={panel}
        isEditing={false}
        isViewing={false}
        isInView={true}
      />
    );
  }

  render() {
    const { dashboard, viewPanel } = this.props;
    const { featureToggles } = getConfig();

    if (!dashboard) {
      return <div></div>;
    }

    const gridWrapperClasses = classNames({
      'dashboard-container': true,
      'dashboard-container--has-submenu': dashboard.meta.submenuEnabled,
    });

    return (
      <div className={gridWrapperClasses}>
        {!featureToggles.newVariables && <SubMenu dashboard={dashboard} />}
        {!this.state.editPanel && featureToggles.newVariables && <SubMenu dashboard={dashboard} />}
        <SizedReactLayoutGrid
          className={classNames({ layout: true })}
          layout={this.buildLayout()}
          isResizable={dashboard.meta.canEdit}
          isDraggable={dashboard.meta.canEdit}
          onLayoutChange={this.onLayoutChange}
          onWidthChange={this.onWidthChange}
          onDragStop={this.onDragStop}
          onResize={this.onResize}
          onResizeStop={this.onResizeStop}
          viewPanel={viewPanel}
        >
          {this.renderPanels()}
        </SizedReactLayoutGrid>
      </div>
    );
  }
}

const mapStateToProps = (state: StoreState) => ({
  urlUid: state.location.routeParams.uid,
  urlSlug: state.location.routeParams.slug,
  urlType: state.location.routeParams.type,
  urlPanelId: state.location.query.panelId,
  dashboard: state.dashboard.getModel() as DashboardModel,
});

const mapDispatchToProps = {
  initDashboard,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(SoloPanelPage));
