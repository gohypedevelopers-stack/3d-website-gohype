import type React from 'react';
import { Html, Body, Head, Heading, Container, Text, Section, Hr } from '@react-email/components';

interface ContactFormEmailProps {
  name: string;
  email: string;
  company?: string;
  message?: string;
}

export const ContactFormEmail: React.FC<Readonly<ContactFormEmailProps>> = ({
  name,
  email,
  company,
  message,
}) => (
  <Html>
    <Head />
    <Body style={{ backgroundColor: '#0f172a', color: '#f8fafc', fontFamily: 'sans-serif' }}>
      <Container style={{ margin: '0 auto', padding: '20px', width: '100%', maxWidth: '600px' }}>
        <Heading style={{ color: '#facc15', fontSize: '28px' }}>🚀 New Project Inquiry!</Heading>
        <Text style={{ fontSize: '16px', lineHeight: '1.5' }}>
          You've received a new quote request from your GoHype Media website.
        </Text>
        <Hr style={{ borderColor: '#334155', margin: '20px 0' }} />
        <Section>
          <Text><strong>From:</strong> {name}</Text>
          <Text><strong>Email:</strong> {email}</Text>
          {company && <Text><strong>Company:</strong> {company}</Text>}
          {message && <Text><strong>Message:</strong><br/>{message}</Text>}
        </Section>
      </Container>
    </Body>
  </Html>
);
