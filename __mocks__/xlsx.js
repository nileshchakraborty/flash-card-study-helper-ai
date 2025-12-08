
import { jest } from '@jest/globals';

export const read = jest.fn();
export const utils = {
    sheet_to_txt: jest.fn()
};

export default {
    read,
    utils
};
