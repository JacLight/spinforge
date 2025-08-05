/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { ControlType } from "./control-type";


export const FileInfoSchema = () => {
  return {
    type: 'object',
    readOnly: true,
    'x-control': ControlType.file,
    properties: {
      path: {
        type: 'string',
      },
      content: {
        type: 'string',
        hidden: true,
      },
      url: {
        type: 'string',
        'x-render': 'file',
      },
      isPublic: {
        type: 'boolean',
        hidden: true,
      },
      meta: {
        type: 'object',
        hidden: true,
        properties: {
          width: {
            type: 'number',
          },
          height: {
            type: 'number',
          },
          size: {
            type: 'number',
          },
          xs: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
              },
              url: {
                type: 'string',
              },
            },
          },
          sm: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
              },
              url: {
                type: 'string',
              },
            },
          },
          md: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
              },
              url: {
                type: 'string',
              },
            },
          },
        },
      }
    },
  } as const;
};