import { Component, type ReactNode } from 'react'

export class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return <p className="scene-message">차량을 불러오지 못했습니다. 페이지를 새로고침해 주세요.</p>
    }
    return this.props.children
  }
}
