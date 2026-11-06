import { Component } from 'react';

/** Keep unexpected view errors recoverable instead of leaving a blank screen. */
export default class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) {
      return <main className="error-state" role="alert" style={{ padding: 32, minHeight: '100vh' }}>
        <h1 className="h3">This page could not be displayed.</h1>
        <p>Reload the application to try again.</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Reload application</button>
      </main>;
    }
    return this.props.children;
  }
}
