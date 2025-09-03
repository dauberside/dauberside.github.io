// CommonJS-style to avoid ESM parsing issues in Jest v30
require('@testing-library/jest-dom');
const { render, screen } = require('@testing-library/react');
const React = require('react');

describe('Sample Test', () => {
  it('renders a simple text', () => {
    render(React.createElement('div', null, 'Hello, World!'));
    expect(screen.getByText('Hello, World!')).toBeInTheDocument();
  });
});
