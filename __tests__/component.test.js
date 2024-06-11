// __tests__/component.test.js
import { render, screen } from '@testing-library/react';
import Component from '../components/Component';

test('renders component', () => {
  render(<Component />);
  const linkElement = screen.getByText(/some text/i);
  expect(linkElement).toBeInTheDocument();
});