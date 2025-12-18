/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    // Default to node, but use overrides for frontend
    testEnvironment: 'node',
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/app/$1',
    },
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            tsconfig: 'tsconfig.jest.json',
            jsx: 'react-jsx', // Important for React 17+
        }],
    },
    // Setup logic for JSDOM / DOM matchers
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
