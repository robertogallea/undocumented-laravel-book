import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import useBaseUrl from '@docusaurus/useBaseUrl';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero', styles.heroBanner)}>
      <div className="container">
        <div className="row">
          <div className="col col--7">
            <Heading as="h1" className="hero__title">
              {siteConfig.title}
            </Heading>
            <p className="hero__subtitle">{siteConfig.tagline}</p>
            <p className={styles.heroDescription}>
              Every entry is a public, realistically usable method or class that is absent
              from the official Laravel documentation, verified against a tagged framework
              release and backed by a real, runnable code example - never a productivity
              shortcut, never pseudocode.
            </p>
            <div className={styles.buttons}>
              <Link
                className="button button--secondary button--lg"
                to="/chapter-0">
                Start reading - Introduction
              </Link>
            </div>
          </div>
          <div className="col col--5">
            <img
              className={styles.heroImage}
              src={useBaseUrl('img/hero.webp')}
              alt="An unfolding layer reveals hidden code underneath, illustrating the book's theme of undocumented Laravel APIs"
            />
          </div>
        </div>
      </div>
    </header>
  );
}

export default function Home() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description="An open-source guide to usable but undocumented Laravel 13 concepts, verified against the tagged framework source.">
      <HomepageHeader />
      <main>
        <section className={styles.section}>
          <div className="container">
            <div className="row">
              <div className="col col--4">
                <Heading as="h3">Undocumented, not obscure</Heading>
                <p>
                  Every entry is public and realistically usable in an application, absent from
                  the official docs by exact method or class name, and never a trivial alias
                  with no instructional value of its own.
                </p>
              </div>
              <div className="col col--4">
                <Heading as="h3">Verified against the source</Heading>
                <p>
                  Every claim is re-checked against the actual tagged <code>laravel/framework</code>{' '}
                  source and the <code>laravel/docs</code> branch, not just against a plan
                  written once and left untouched.
                </p>
              </div>
              <div className="col col--4">
                <Heading as="h3">Real, runnable examples</Heading>
                <p>
                  Every snippet is extracted from a companion Laravel application and proven
                  green by its own Pest test suite - never invented pseudocode.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
